const CFG_URL = "baidu.com";
var http = require('http');
var json_data = JSON.stringify({
    source: ["fs","ss"],
    trans_type: "en2zh",
    page_id: 144200,
    replaced: true,
    cached: true
})

var makeRequest = function(message) {
    var options = {
        host: CFG_URL,
        port: 80,
        path: '/',
        method: 'POST',
        timeout: 1500,
        headers: {
            'Content-Type': 'application/text',
            'Content-Length': message.length
        }
    }

    var request = http.request(options, function(response) {
        response.on('data', function(data) {
            console.log(data);
        });
    });

    process.on('uncaughtException', function (err) {
        console.log(err);
    });

    request.write(message);
    request.end();
}

makeRequest(json_data);