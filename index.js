'use strict';

var fs   = require ('fs');
var path = require ('path');
var fse  = require ('fs-extra');

var cpFile = function (src, dest) {
  var fMode = fs.lstatSync (src).mode;
  var fdr = fs.openSync (src, 'r');
  var fdw = fs.openSync (dest, 'w');
  var bytesRead = 1;
  var pos = 0;

  var BUF_LENGTH = 64 * 1024;
  var buf = new Buffer (BUF_LENGTH);

  while (bytesRead > 0) {
    bytesRead = fs.readSync (fdr, buf, 0, BUF_LENGTH, pos);
    fs.writeSync (fdw, buf, 0, bytesRead);
    pos += bytesRead;
  }

  fs.closeSync (fdr);
  fs.closeSync (fdw);
  fs.chmodSync (dest, fMode);
};

exports.mkdir = function (location, root) {
  var dirs = location.split (path.sep);
  var dir  = dirs.shift ();
  root = (root || '') + dir + path.sep;

  try {
    fs.mkdirSync (root);
  } catch (err) {
    if (!fs.statSync (root).isDirectory ()) {
      throw new Error (err);
    }
  }

  return !dirs.length || exports.mkdir (dirs.join (path.sep), root);
};

exports.cp = function (src, dest) {
  var stats = fs.lstatSync (src);

  if (stats.isFile ()) {
    cpFile (src, dest);
  } else if (stats.isDirectory ()) {
    exports.mkdir (dest);
    fs.readdirSync (src).forEach (function (item) {
      exports.cp (path.join (src, item), path.join (dest, item));
    });
  }
};

exports.rmdir = function (location) {
  fse.removeSync (location);
};

exports.lsdir = function (location, regex) {
  var listIn = fs.readdirSync (location);
  var listOut = [];

  listIn.forEach (function (item) {
    if (regex && !regex.test (item)) {
      return;
    }

    var dir = path.join (location, item);
    var st = fs.statSync (dir);
    if (st.isDirectory (dir)) {
      listOut.push (item);
    }
  });

  return listOut;
};

exports.ls = function (location, regex) {
  var listIn = fs.readdirSync (location);
  var listOut = [];

  listIn.forEach (function (item) {
    if (regex && !regex.test (item)) {
      return;
    }

    listOut.push (item);
  });

  return listOut;
};

exports.mv = function (src, dest) {
  /* FIXME: use move instead */
  exports.mkdir (path.dirname (dest));
  exports.cp (src, dest);
  exports.rmdir (src);
};

exports.canExecute = function (file) {
  var mask = 1;
  var st;

  try {
    st = fs.statSync (file);
  } catch (err) {
    return false;
  }

  return !!(mask & parseInt ((st.mode & parseInt ('777', 8)).toString (8)[0]));
};
