var connect = require('connect');

connect.createServer(connect.static(__dirname)).listen(parseInt(process.argv[2]) || 10884);
