var util = require('util');
const axios = require('axios')
const fs = require('fs');
const path=require('path');

const DEAL_ED_FLAG = "JKFSDJFKDSJKFJKJk_HAS_TRANSLATION"


const CFG_URL = "http://trans1.api.martinsong.org";
//const CFG_URL = "http://127.0.0.1:9991";


//example
//'{"source":["奋斗","复旦","饭店"],
// "trans_type":"zh2en",
// "request_id":"web-translate",
// "page_id":144200,
// "replaced":true,
// "cached":true}'

// 构建请求body数据对象
var buildRequest = function (texts) {
    var json_data = {
        url:"",
        source: texts,
        fromlang: "en",
        tolang: "zh",
        trans_type: "en2zh",
        page_id: 144200,
        replaced: true,
        cached: true
    };
    return json_data;
}

// 解析翻译api结果数据
var parseReceiveInfo = function (res) {
    var zh_data = [];
    res.data.target.forEach((item)=>zh_data.push(item.target.slice(24)));
    return zh_data;
}

var translatePrefile = {
    up5000Time: 0,
    otherTime: 0,
}
//翻译过程
var translateTenApi = async function(texts) {
    let allGroups = [];

    let curGroup = [];

    let curCharCount = 0;
    for(var i=0,len=texts.length; i<len; i+=1){
        let curText = texts[i];
        curCharCount += curText.length;
        curGroup.push(curText);
        if(curCharCount > 5000)
        {
            translatePrefile.up5000Time++;
            var data = buildRequest(curGroup);
            curCharCount = 0;
            curGroup = [];
            let response = await axios({
                url: CFG_URL,
                method: "POST",
                timeout: 5000,
                headers: { "Content-Type": "application/json" },
                data:  JSON.stringify(data),
            })
            var zh_data = parseReceiveInfo(response);
            allGroups = allGroups.concat(zh_data);
        }
    }
    // 之前逻辑是 一个文件翻译内容没有超过5000，才开始翻译，但是很多文件加起来不够5000，导致这里很慢
    translatePrefile.otherTime++;
    if(curGroup.length) {
        data = buildRequest(curGroup);
        let response = await axios({
            url: CFG_URL,
            method: "POST",
            timeout: 5000,
            headers: { "Content-Type": "application/json" },
            data:  JSON.stringify(data),
        })
        zh_data = parseReceiveInfo(response);
        allGroups = allGroups.concat(zh_data);
    }
    console.log(JSON.stringify(translatePrefile));
    return allGroups;
}

//遍历目录下的所有文件
//可设定忽略扫描，1为忽略
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
}

//不同代码族的正则和替换模式map
let suffix2Regexp = {
    "cLike": [/\/\*(([\s\S\n])*?)\*\/|\/\/(.*)/g, m => m[1] || m[3], [[/([^\/]|^)\/\*(([\s\S\n])*?)\*\//g,"$1/*%s*/ "], [/\/\/(.*)/g, "//%s"]]
        ,[[/\r\*/g, "\r * "], [/\r  \*/g, "\r * "], [/\*  。/g,"*"]]],
    "pyLike": [/#(.*)/g, m => m[1], [[/#(.*)/g, "# %s "]],[] ],
    "vbLike": [/;(.*)/g, m => m[1], [[/;(.*)/g, "; %s "]],[] ]
}

//逻辑：/* //一样高
//    /\*([\n.]*)\*/
//    //.*\n
//   /\*(.*)\*/|//(.*)\n
var dealWithFile = async function(filePath) {
    var fileContent = fs.readFileSync(filePath).toString();
    //找到所有的注释行和注释块
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

    // let curCount = 0;
    // let curArr = [];
    // while (curCount < )

    //翻译块
    let zh_arr;
    try {
        zh_arr = await translateTenApi(texts);
    }
    catch (e) {
        try {
            zh_arr = await translateTenApi(texts);
        }
        catch (e) {
            try {
                zh_arr = await translateTenApi(texts);
            }
            catch (e) {
                return null;
            }
        }
    }

    zh_arr.forEach((desc, i)=>zh_arr[i] = desc.replace(/\*\//g, " * / "));
    zh_arr.forEach((desc, i)=>zh_arr[i] = desc.replace(/\\\*/g, " \ * "));

    //备份已有的%s, %d, %f等为MfNlHt35wvkv43hhe-s, MfNlHt35wvkv43hhe-d, MfNlHt35wvkv43hhe-f
    const regexp_s = RegExp("%s",'g');
    const regexp_d = RegExp("%d",'g');
    const regexp_f = RegExp("%f",'g');
    let content = fileContent.replace(regexp_s, "MfNlHt35wvkv43hhe-s");
    content = content.replace(regexp_d, "MfNlHt35wvkv43hhe-d");
    content = content.replace(regexp_f, "MfNlHt35wvkv43hhe-f");

    //替换%s
    let replaceInfoes = regInfo[2];
    replaceInfoes.forEach(reInfo=>{
        content = content.replace(reInfo[0], reInfo[1]);
    });
    if(texts.length !== zh_arr.length){
        console.log("翻译结果不一致");
    }

    let beautyInfoes = regInfo[3];
    if(beautyInfoes) {
        zh_arr.forEach((zh,i)=>{
            beautyInfoes.forEach(info=>{
                zh_arr[i] = zh_arr[i].replace(info[0], info[1]);
            })
        })
    }

    //填充翻译结果
    content = util.format(content, ...zh_arr);

    //恢复已有的%s, %d, %f等为MfNlHt35wvkv43hhe-s, MfNlHt35wvkv43hhe-d, MfNlHt35wvkv43hhe-f
    content = content.replace(/MfNlHt35wvkv43hhe-s/g, "%s");
    content = content.replace(/MfNlHt35wvkv43hhe-d/g, "%d");
    content = content.replace(/MfNlHt35wvkv43hhe-f/g, "%f");
    var hadTranslations = "// "+DEAL_ED_FLAG+" \n";
    console.log(filePath);
    //写入文件

    content = hadTranslations + content;
    fs.writeFile(filePath, content, err => {
        if (err) {
            console.error(err)
        }
        //文件写入成功。
    })
    return null;
}


var allFiles = [];

var forEachFiles = function (dir, oneFile){
    if(matchSuffixes[path.extname(dir)] && dir.indexOf("node_modules") === -1){
        allFiles.push(dir);
        return;
    }
    let alldir = fs.readdirSync(dir);
    for (var fileIndex in alldir) {
        let file = alldir[fileIndex];
        var pathname=path.join(dir,file);
        if(oneFile) {
            if( pathname.indexOf(oneFile)>0) {
                allFiles.push(pathname);
            }
        }
        else {
            if(fs.statSync(pathname).isDirectory()){
                forEachFiles(pathname);
            }else if(matchSuffixes[path.extname(pathname)] && pathname.indexOf("node_modules") === -1){
                console.log("add "+ pathname);
                allFiles.push(pathname);
            }
        }
    }
}

var waitFileInfo = {
    mmap: {},
    textNumber: 0,
};
var dealForEachFiles = async function (){
    for (var fileIndex in allFiles) {
        let pathname = allFiles[fileIndex];
        if(fileIndex % 30 === 0)
        {
            await dealWithFile(pathname);
        }
        dealWithFile(pathname);
        // var dealRet = await dealWithFile(pathname);
        // 少于50000字，则不处理，累计处理所有文件
        // if(dealRet.lessContent) {
        //     // 将文件内容放到map中，等待处理
        //     waitFileMap.mmap[pathname] = dealRet.content;
        //     waitFileInfo.textNumber += dealRet.content.length;
        //     var dealRet = await dealWithFile(pathname);
        // }
    }
}


var main = async function () {
    allFiles = [];
    let rootPath = "d:/workplace/cc/baby-git/";
    forEachFiles(rootPath, "init");
    await dealForEachFiles();
    //完成，MD，记一次肚子疼写代码的经历
}

var test = function () {
    let zh_arr = translate(["fdsfds","song","jfoskdj jsdjf a s8 sfs"]);
}

//入口 
main();

//test();
