var util = require('util');
const axios = require('axios')
const fs = require('fs');
const path=require('path');


const CFG_URL = "http://127.0.0.1:9991";


//example
//'{"source":["奋斗","复旦","饭店"],
// "trans_type":"zh2en",
// "request_id":"web-translate",
// "page_id":144200,
// "replaced":true,
// "cached":true}'
var buildRequest = function (texts) {
    var json_data = {
        url:"",
        source: texts,
        trans_type: "en2zh",
        page_id: 144200,
        replaced: true,
        cached: true
    };
    return json_data;
}

var parseRespones = function (res) {
    var zh_data = [];
    res.data.target.forEach((item)=>zh_data.push(item.target.slice(26)));
    return zh_data;
}

var translate = async function(texts, callback) {
    var data = buildRequest(texts);
    let str = JSON.stringify(data);
    let response = await axios({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        url: CFG_URL,
        data: str
    })
    var zh_data = parseRespones(response);
    console.log(zh_data)
}

//逻辑：/* //一样高
//    /\*([\n.]*)\*/
//    //.*\n
//   /\*(.*)\*/|//(.*)\n

var dealWithFile = function(filePath) {
    const fileContent = fs.readFileSync(filePath).toString();
    //找到所有的注释行和注释块
    const regexp = RegExp("(/\*(.*)\\*/)|(//(.*)\\n)",'g');
    let results = fileContent.matchAll(regexp);
    let texts = Array.from(results, m => m[0]);

    if(!texts.length) return;

    //翻译块
    translate(texts, function (zh_arr){
        //替换%s
        const regexp2 = RegExp("//(.*)\\n",'g');
        let content = fileContent.replace(regexp2, "%s\n");
        const regexp1 = RegExp("/\*(.*)\\*/",'g');
        content = content.replace(regexp1, "%s");
        if(texts.length !== zh_arr.length){
            console.log("翻译结果不一致");
        }

        //填充翻译结果
        var result_content = util.format(content, ...texts);
        console.log(result_content);

        //写入文件

    })
}

//遍历目录下的所有文件
let matchSuffixes = {
    ".c":1,
    ".cpp":1,
    ".h":1,
    ".hpp":1
}

var travel = function (dir){
    fs.readdirSync(dir).forEach((file)=>{
        var pathname=path.join(dir,file);
        if(fs.statSync(pathname).isDirectory()){
            travel(pathname);
        }else if(matchSuffixes[path.extname(pathname)]){
            dealWithFile(pathname);
        }
    })
}

var forEachFiles =  function (rootPath) {
     travel(rootPath);
}

var main = function () {
    let rootPath = "D:\\workplace\\cpp\\RuiKeStd_Soui2.x-master\\RuiKeStd\\aa\\";
    forEachFiles(rootPath);
    //完成，MD，记一次肚子疼写代码的经历
}

var test = function () {
    let zh_arr = translate(["fdsfds","song","jfoskdj jsdjf a s8 sfs"]);
}

//入口
main();

//test();
