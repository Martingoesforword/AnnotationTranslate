var util = require('util');
const axios = require('axios')
const fs = require('fs');
const path= require('path');

// 翻译接口地址
const CFG_URL = "http://trans1.api.martinsong.org";
// const CFG_URL = "http://127.0.0.1:9991";
// 跳过文件或目录列表
const skipLikeMap = {
    "node_module": 1,
    ".git": 1,
    ".vscode": 1,
    ".idea": 1,
}
// 遍历目录下的所有文件
// 可设定忽略扫描，1为忽略
let matchSuffixes = {
    ".c":       ["cLike", 0],
    ".cc":      ["cLike", 0],
    ".cpp":     ["cLike", 0],
    ".h":       ["cLike", 0],
    ".js":      ["cLike", 0],
    ".ts":      ["cLike", 0],
    ".java":    ["cLike", 0],
    ".py":      ["pyLike", 0],
    ".nas":     ["vbLike", 0],
    //todo: 替换为目标
    ".test":     ["selfLike", 0],
}
// 不同代码族的正则和替换模式map

//todo: 合并匹配表达式和替换表达式
let suffix2Regexp = {
    "cLike": [
        // 匹配 正则表达式
        /(\n|^)[^"\n]*?\/\*(([\s\S\n])*?)\*\/|(\n|^)[^"\n]*?\/\/(.*)/g,
        // 从m中获取匹配组的函数，获得真正的注释文本
        m=> m[2] || m[5],
        [
            [
                // 将 /*注释*/ 文本提前替换为/*%s*/的 正则表达式
                /((\n|^)[^"\n]*?)\/\*(([\s\S\n])*?)\*\//g, "$1/* %s */ "
            ],
            [
                // 将 //注释 文本提前替换为//%s的 正则表达式
                /((\n|^)[^"\n]*?)\/\/(.*)/g, "$1// %s"
            ]
        ],
        [
            [
                // 美化 正则替换表达式
                // "/\*%s\*/", "/\*\r\n%s\r\n\*/"
            ]
        ]
    ],
    // todo: 实现有问题，需要考虑#是否是代码AST字符而不是字符串字符，vb有同样的问题
    // "pyLike": [/\n[^#\n]*?#([^#\n]*)/g, m => m[1], [[/\n([^#\n]*?)#([^#\n]*)/g, "\n$1=%s"]],[] ],
    // "vbLike": [/\n[^#\n]*?=([^#\n]*)/g, m => m[1], [[/\n([^#\n]*?)=([^#\n]*)/g, "\n$1=%s"]],[] ],
    "selfLike": [/\n[^#\n]*?=([^#\n]*)/g, m => m[1], [[/\n([^#\n]*?)=([^#\n]*)/g, "\n$1=%s"]],[] ],
}
const FROM_LANG = "zh"
const TO_LANG = "en"
// 较固定配置
var preReplacePrefix = "ANNOTATION_TRANSLATE";
preReplacePrefix += "_TAG";
const preReplaceMatchList = ["d","f","s","o","c","%"];
const DEAL_ED_FLAG = "THIS_SOURCES_HAS_BEEN_TRANSLATED"

/**
 * 请求翻译接口
 * @param curGroup
 * @returns {Promise<*[]>}
 */
var fireTranslate = async function(curGroup) {
    var json_data = {
        url:"",
        source: curGroup,
        fromlang: FROM_LANG,
        tolang: TO_LANG,
        trans_type: FROM_LANG+"2"+TO_LANG,
        page_id: 144200,
        replaced: true,
        cached: true
    };
    let response = await axios({
        url: CFG_URL,
        method: "POST",
        timeout: 5000,
        headers: { "Content-Type": "application/json" },
        data:  JSON.stringify(json_data),
    });
    var zh_data = [];
    response.data.target.forEach(item=>{
        let one = item.target.slice(24);
        zh_data.push(one);
    });
    return zh_data;
}

/**
 * 建立单次翻译列表
 * @param texts
 * @param profile
 * @returns {Promise<*[]>}
 */
var translateTenApi = async function(texts, profile) {
    let allGroups = [];
    let curGroup = [];
    let curCharCount = 0;

    for (let curText of texts) {
        curText = curText.trim();
        curCharCount += curText.length;
        curGroup.push(curText);
        if(curCharCount > 5000)
        {
            let zh_data = await fireTranslate(curGroup);
            allGroups = allGroups.concat(zh_data);

            // 清空5000计数
            curCharCount = 0;
            curGroup = [];

            // 运行记录
            profile.up5000Time++;
        }
    }
    // 之前逻辑是 一个文件翻译内容没有超过5000，才开始翻译，但是很多文件加起来不够5000，导致这里很慢
    if(curGroup.length) {
        let zh_data = await fireTranslate(curGroup);
        allGroups = allGroups.concat(zh_data);

        profile.otherTime++;
    }
    return allGroups;
}

/**
 * 处理一个文件
 * @param filePath
 * @param profile
 * @returns {Promise<null>}
 */
var dealWithFile = async function(filePath, profile) {
    var fileContent = fs.readFileSync(filePath).toString();
    // 找到所有的注释行和注释块
    let results;
    let texts;

    let ext = path.extname(filePath);
    if(!matchSuffixes[ext] || matchSuffixes[ext][1])
    {
        return null;
    }
    if(fileContent.match(DEAL_ED_FLAG)) {
        return null;
    }
    let regKey = matchSuffixes[ext][0];
    let regInfo = suffix2Regexp[regKey];
    results = fileContent.matchAll(regInfo[0]);
    texts = Array.from(results, regInfo[1]);

    if(!texts.length) return null;


    // 尝试翻译3次，失败直接返回
    let tryTimes = 3;
    let zh_arr;
    while (tryTimes--) {
        try {
            zh_arr = await translateTenApi(texts, profile);
            break;
        }
        catch (e) {
            if(!tryTimes) {
                return null;
            }
        }
    }
    if(texts.length !== zh_arr.length){
        console.warn("翻译结果不一致");
    }

    zh_arr.forEach((desc, i)=>zh_arr[i] = desc.replace(/\*\//g, " *-/ "));
    zh_arr.forEach((desc, i)=>zh_arr[i] = desc.replace(/\\\*/g, " \-* "));

    // 备份已有的%s, %d, %f等为MfNlHt35wvkv43hhe-s, MfNlHt35wvkv43hhe-d, MfNlHt35wvkv43hhe-f, MfNlHt35wvkv43hhe-o
    var content = fileContent;
    preReplaceMatchList.forEach(match=>{
        const regexp = RegExp("%"+match,'g');
        content = content.replace(regexp, preReplacePrefix+"-"+match);
    })

    // 替换%s
    let replaceInfos = regInfo[2];
    replaceInfos.forEach(reInfo=>{
        content = content.replace(reInfo[0], reInfo[1]);
    });

    // 美化翻译结果
    let beautyInfos = regInfo[3];
    if(beautyInfos) {
        zh_arr.forEach((zh,i)=>{
            beautyInfos.forEach(info=>{
                zh_arr[i] = zh_arr[i].replace(info[0], info[1]);
            })
        })
    }

    // 填充翻译结果
    content = util.format(content, ...zh_arr);

    // 恢复已有的%s, %d, %f等为MfNlHt35wvkv43hhe-s, MfNlHt35wvkv43hhe-d, MfNlHt35wvkv43hhe-f
    preReplaceMatchList.forEach(match=>{
        const regexp = RegExp(preReplacePrefix+"-"+match,'g');
        content = content.replace(regexp, "%"+match);
    });

    var hadTranslations = "// "+DEAL_ED_FLAG+" \n";

    // 写入文件
    content = hadTranslations + content;
    fs.writeFile(filePath, content, err => {
        if (err) {
            console.error(err)
        }
        // 文件写入成功。
    });

    console.log(filePath);
    return null;
}

/**
 * 遍历路径，构建待处理文件列表
 * @param allFiles
 * @param dirPath
 * @param oneFile
 */
var forEachFiles = function (allFiles, dirPath, oneFile){
    // 跳过文件 或者目录
    var dirName = path.basename(dirPath);
    if(skipLikeMap[dirName.toString()]) {
        return;
    }
    var stat = fs.lstatSync(dirPath);

    if(stat.isFile(dirPath)){
        if(matchSuffixes[path.extname(dirPath)]) {
            if(oneFile) {
                if(dirPath.indexOf(oneFile) !== -1) {
                    allFiles.push(dirPath);
                }
            }
            else {
                allFiles.push(dirPath);
            }
        }
    }
    else {
        let subDirArr = fs.readdirSync(dirPath);
        subDirArr.forEach(subDir=>{
            var subDirPath = path.join(dirPath,subDir);
            forEachFiles(allFiles, subDirPath, oneFile);
        })
    }
}

/**
 * 多线程实现
 * @param allFiles
 * @param profile
 * @returns {Promise<void>}
 */
var dealForEachFiles = async function (allFiles, profile){
    let number = 0;
    for (const pathname of allFiles) {
        if(++number > 20)
        {
            await dealWithFile(pathname, profile);
            number = 0;
        }
        dealWithFile(pathname, profile);
    }
}


var main = async function () {
    var translateProfile = {
        up5000Time: 0,
        otherTime: 0,
    }

    let rootPath = "D:\\workplace\\js\\AnnotationTranslate\\example";

    var allFiles = [];
    forEachFiles(allFiles, rootPath);
    await dealForEachFiles(allFiles, translateProfile);

    console.log(JSON.stringify(translateProfile));
    //完成，MD，记一次肚子疼写代码的经历
}

//入口
main();

//test();
