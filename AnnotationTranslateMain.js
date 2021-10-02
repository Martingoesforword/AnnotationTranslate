var util = require('util');
const axios = require('axios')
const CFG_URL = "http://34.92.172.241:6700";


//example
//'{"source":["奋斗","复旦","饭店"],
// "trans_type":"zh2en",
// "request_id":"web-translate",
// "page_id":144200,
// "replaced":true,
// "cached":true}'
var buildRequest = function (texts) {
    var json_data = JSON.stringify({
        source: texts,
        trans_type: "en2zh",
        page_id: 144200,
        replaced: true,
        cached: true
    })
    return json_data;
}

var parseRespones = function (json_data) {
    var zh_data = [];
    return zh_data;
}

var requestMyTencent = function (data) {
    return axios.post(CFG_URL, data);
}

var tencentTransZh = function (texts) {
    var json_data = buildRequest(texts);
    var respones_data = requestMyTencent(json_data);
    var zh_data = parseRespones(respones_data);
    return zh_data;
}


var translate = function(texts) {
    //构建腾讯翻译接口数据json
    //zh_data是和texts长度一样的数组
    var zh_data = tencentTransZh(texts);
    return zh_data;
}

//逻辑：/* //一样高
//    /\*([\n.]*)\*/
//    //.*\n
//   /\*(.*)\*/|//(.*)\n

var dealWithFile = function(filePath, dealCall) {

    let fileContent = "";
    //找到所有的注释行和注释块
    const regexp = RegExp("(/\*(.*)\\*/)|(//(.*)\\n)",'g');
    let results = fileContent.matchAll(regexp);
    let texts = Array.from(results, m => m[0]);

    //翻译块
    let zh_arr = translate(texts);

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

}

//遍历目录下的所有文件
let matchSuffixes = {
    ".c":1,
    ".cpp":1,
    ".h":1,
    ".hpp":1
}
var forEachFiles = function (rootPath) {
    let curPathNode = rootPath.getAllNode();

    curPathNode.forEach(function (node) {
        if(node.isFile())
        {
            //文件的话获取后缀判断属不属于需要替换的文件
            var suffix = "";
            if(matchSuffixes[suffix])
            {
                dealWithFile(node.path);
            }
        }
        else if(node.isFolder())
        {
            forEachFiles(node.path);
        }
    })
}

var main = function () {
    let rootPath = "";
    forEachFiles(rootPath);
    //完成，MD，记一次肚子疼写代码的经历
}

var test = function () {
    let zh_arr = translate(["fdsfds","song","jfoskdj jsdjf a s8 sfs"]);
}

//入口
//main();

test();