var util = require('util');
const axios = require('axios')
const fs = require('fs');
const path=require('path');



const CFG_URL = "http://trans.api.martinsong.org";
//const CFG_URL = "http://127.0.0.1:9992";


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

//翻译过程
var translateTenApi = async function(texts) {
    let allGroups = [];

    let curGroup = [];

    let curCharCount = 0;
    for(var i=0,len=texts.length; i<len; i+=1){
        let curText = texts[i];
        curCharCount += texts.length;
        if(curCharCount > 5000)
        {
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
        curGroup.push(curText);
    }
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
    ".nas":     ["pyLike", 0],
}

//不同代码族的正则和替换模式map
let suffix2Regexp = {
    "cLike": ["/\\*(([\\s\\S\\n])*?)\\*/|//(.*)", m => m[1] || m[3], [["//(.*)", "//%s"], ["/\\*(([\\s\\S\\n])*?)\\*/","/*%s*/"]]],
    "pyLike": [";(.*)", m => m[1], [[";(.*)", ";%s"]] ]
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
        return;
    }
    let regKey = matchSuffixes[ext][0];
    let regInfo = suffix2Regexp[regKey];
    const regexp = RegExp(regInfo[0],'g');
    results = fileContent.matchAll(regexp);
    texts = Array.from(results, regInfo[1]);

    if(!texts.length) return;

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
                return;
            }
        }
    }

    zh_arr.forEach((desc, i)=>zh_arr[i] = desc.replace(/\*\//g, "* /"));

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
        const regexp = RegExp(reInfo[0],'g');
        content = content.replace(regexp, " "+reInfo[1]+" ");
    });
    if(texts.length !== zh_arr.length){
        console.log("翻译结果不一致");
    }


    //填充翻译结果
    content = util.format(content, ...zh_arr);

    //恢复已有的%s, %d, %f等为MfNlHt35wvkv43hhe-s, MfNlHt35wvkv43hhe-d, MfNlHt35wvkv43hhe-f
    content = content.replace(/MfNlHt35wvkv43hhe-s/g, "%s");
    content = content.replace(/MfNlHt35wvkv43hhe-d/g, "%d");
    content = content.replace(/MfNlHt35wvkv43hhe-f/g, "%f");

    console.log(filePath);
    //写入文件

    fs.writeFile(filePath, content, err => {
        if (err) {
            console.error(err)
        }
        //文件写入成功。
    })
}


var allFiles = [];

var forEachFiles = function (dir){
    let alldir = fs.readdirSync(dir);
    for (var fileIndex in alldir) {
        let file = alldir[fileIndex];
        var pathname=path.join(dir,file);
        if(fs.statSync(pathname).isDirectory()){
            forEachFiles(pathname);
        }else if(matchSuffixes[path.extname(pathname)] && pathname.indexOf("node_modules") === -1){
            allFiles.push(pathname);
        }
    }
}

var dealForEachFiles = async function (){
    for (var fileIndex in allFiles) {
        let pathname = allFiles[fileIndex];
        if(fileIndex % 20 === 0)
        {
            await dealWithFile(pathname);
        }
        dealWithFile(pathname);
    }
}


var main = async function () {
    let rootPath = "D:\\workplace\\cpp\\RuiKeStd_Soui2.x-master\\include";
    forEachFiles(rootPath);
    await dealForEachFiles();
    //完成，MD，记一次肚子疼写代码的经历
}

var test = function () {
    let zh_arr = translate(["fdsfds","song","jfoskdj jsdjf a s8 sfs"]);
}

//入口
main();

//test();
