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

/**
 * Copy a file or the content of a directory.
 *
 * Examples:
 *   `cp ('indir/infile', 'outdir/outfile');`
 *   - The file is moved and renamed. When the source is a file, the
 *     destination must always be a file.
 *   `cp ('indir', 'outdir');``
 *   - The content of indir is copied in outdir. It's important to note that
 *     outdir can exists with already a content, then the source files will
 *     add or replace the other files at the destination. The other files
 *     are not removed.
 *
 * The intermediate directories are created if necessary (a la mkdir -p).
 *
 * @param {string} src - The file or directory to copy.
 * @param {string} dest - The file or the destination directory.
 */
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

exports.rm = function (location) {
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

/**
 * Move a file or the content of a directory.
 *
 * The source directory is not renamed, it's the content which is moved.
 * Examples:
 *   `mv ('indir/infile', 'outdir/outfile');``
 *   - The file is moved and renamed. When the source is a file, the
 *     destination must always be a file.
 *   `mv ('indir', 'outdir');``
 *   - The content of indir is moved in outdir. It's important to note that
 *     outdir can exists with already a content, then the source files will
 *     add or replace the other files at the destination. The other files
 *     are not removed.
 *
 * The intermediate directories are created if necessary (a la mkdir -p).
 *
 * @param {string} src - The file or directory to move.
 * @param {string} dest - The file or the destination directory.
 */
exports.mv = function (src, dest) {
  var stats = fs.lstatSync (src);

  if (stats.isFile ()) {
    exports.mkdir (path.dirname (dest));
    fs.renameSync (src, dest);
  } else if (stats.isDirectory ()) {
    exports.mkdir (dest);
    fs.readdirSync (src).forEach (function (item) {
      try {
        /* Try the faster move. */
        fs.renameSync (path.join (src, item), path.join (dest, item));
      } catch (ex) {
        /* Or use a copy / rm if it fails. */
        exports.cp (path.join (src, item), path.join (dest, item));
        exports.rm (path.join (src, item));
      }
    });

    exports.rm (src);
  }
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

exports.newerFiles = function (location, regex, mtime) {
  var listIn = fs.readdirSync (location);

  return listIn.some (function (item) {
    if (regex && !regex.test (item)) {
      return;
    }

    var file = path.join (location, item);
    var st   = fs.statSync (file);

    if (st.isDirectory ()) {
      return exports.newerFiles (file, regex, mtime);
    }

    return st.mtime > mtime;
  });
};
