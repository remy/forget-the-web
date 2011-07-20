var noop = function () {
  // console.log('noop', [].slice.call(arguments));
};

if (typeof window.mozIndexedDB !== 'undefined') {
  window.indexedDB = mozIndexedDB;
  // window.IDBTransaction = window.mozIDBTransaction;
} else if (typeof window.webkitIndexedDB !== 'undefined') {
  window.indexedDB = webkitIndexedDB;
  window.IDBTransaction = window.webkitIDBTransaction;
}

var DataStore = noop;

DataStore.prototype = {
  init: function (callback) {
    var datastore = this;
    if (typeof window.indexedDB !== 'undefined') {
      this.dbtype = 'indexeddb';
      var request = indexedDB.open('notes1');
      
      request.onerror = function () {
        console.log('failed to open indexedDB');
      };
      
      request.onsuccess = function (event) {
        var v = '1.0';
        datastore.db = event.target.result;
        
        if (v !== datastore.db.version) {
          var setVRequest = datastore.db.setVersion(v);
          setVRequest.onsuccess = function () {
            var store = datastore.db.createObjectStore('notes', {keyPath: 'id'});
            callback && callback();
          };
          setVRequest.onerror = function () {
            callback && callback();
          };
        } else {
          callback && callback();
        }
      };
    } else if (typeof window.openDatabase !== 'undefined') {
      // web sql databases
      this.dbtype = 'sql';
      this.db = openDatabase('Conference Notes', '1.0', 'notes', 5 * 1024 * 1024);

      this.db.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS ' + 
                      'notes(id TEXT PRIMARY KEY ASC, title TEXT, rating INTEGER, date DATE, notes TEXT, updated DATE, url TEXT UNIQUE)', [], callback, callback);
      });
    } else {
      console.log('you are screwed');
    }
  },
  add: function (conf, success, error) {
    success = success || noop;
    error = error || noop;
    if (this.dbtype == 'indexeddb') {
      var transaction = this.db.transaction(['notes'], IDBTransaction.READ_WRITE, 0),
          store = transaction.objectStore('notes'),
          request = store.add(conf);
          
      request.onsuccess = function () {
        success(conf);
      };
      request.onerror = error;
      
    } else if (this.dbtype == 'sql') {
      this.db.transaction(function (tx) {
        tx.executeSql('INSERT INTO notes (id, title, url, date) VALUES (?, ?, ?, ?)', [conf.id, conf.title, conf.url, conf.date], function () {
          success(conf);
        }, error);
      });
    }
    
  },
  update: function (conf) {
    if (this.dbtype == 'indexeddb') {
      var transaction = this.db.transaction(['notes'], IDBTransaction.READ_WRITE, 0),
          store = transaction.objectStore('notes'),
          request = store.put(conf); 

      // request.onsuccess = function () {};
      request.onerror = function () {
        console.log('failed to save', [].slice.call(arguments));
      };
    } else if (this.dbtype == 'sql') {
      this.db.transaction(function (tx) {
        tx.executeSql('UPDATE notes SET notes=?, rating=?, updated=date("now") WHERE id=?', [conf.notes, conf.rating, conf.id], noop, noop);
      });
    }
  },
  getall: function (success, error) {
    success = success || noop;
    error = error || noop;
    if (this.dbtype == 'indexeddb') {
      var transaction = this.db.transaction(['notes'], IDBTransaction.READ_WRITE, 0),
          store = transaction.objectStore('notes');

      var data = [];
      store.openCursor().onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor['continue'](); // wicked - fucking Mobile Safari vomits on this code
        } else {
          success(data);
        }
      };
    } else if (this.dbtype == 'sql') {
      this.db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM notes ORDER BY date DESC', [], function (tx, rs) {
          var data = [];
          for (var i = 0; i < rs.rows.length; i++) {
            data.push(rs.rows.item(i));
          }
          success(data);
        }, function () {
          console.log('fail', [].slice.call(arguments));
        });
      });
    }
  },
  get: function (id, success, error) {
    success = success || noop;
    error = error || noop;
    if (this.dbtype == 'indexeddb') {
      var transaction = this.db.transaction(['notes'], IDBTransaction.READ_WRITE, 0),
          store = transaction.objectStore('notes'),
          request = store.get(id);
          
      request.onsuccess = function (event) {
        success(event.target.result);
      };
      request.onerror = function () {
        console.log('failed to get');
      };
    } else if (this.dbtype == 'sql') {
      this.db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM notes WHERE id = ?', [id], function (tx, rs) {
          success(rs.rows.item(0));
        }, error);
      });
    }
    
  },
  drop: function () {
    var datastore = this;
    if (this.dbtype == 'indexeddb') {
      // indexedDB.deleteDatabase('notes'); // not supported - wicked.
      this.getall(function (data) {
        data.forEach(function (data) {
          var trans = datastore.db.transaction(['notes'], IDBTransaction.READ_WRITE).objectStore('notes')['delete'](data.id);
                                                                                                      // ^-- again, mobile safari being a dick
        });
      });
    } else if (this.dbtype == 'sql') {
      this.db.transaction(function (tx) {
        tx.executeSql('DROP TABLE IF EXISTS notes');
      });
    }
  }
};