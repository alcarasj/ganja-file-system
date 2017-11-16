var weedClient = require("node-seaweedfs");
 
var client = new weedClient({
    server:		"localhost",
    port:		9333
});
 
client.write("./file.png").then(function(fileInfo) {
    return client.read(fileInfo.fid);
}).then(function(Buffer) {
    //do something with the buffer 
}).catch(function(err) {
    //error handling 
});