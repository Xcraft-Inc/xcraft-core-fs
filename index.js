'use strict';

const fs           = require ('fs');
const path         = require ('path');
const fse          = require ('fs-extra');
const isBinaryFile = require ('isbinaryfile');

exports.batch = {};

var cpFile = function (src, dest) {
  const st = fs.lstatSync (src);
  const fMode = st.mode;

  if (st.isSymbolicLink ()) {
    const link = fs.readlinkSync (src);
    try {
      fs.unlinkSync (dest);
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
    fs.symlinkSync (link, dest);
    return;
  }

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

var batch = function (oldfileName, newFileName, location, action) {
  const isRegExp = oldfileName instanceof RegExp;
  var files = exports.ls (location);

  files.forEach (function (file) {
    var st = fs.lstatSync (path.join (location, file));
    if (st.isDirectory ()) {
      exports.batch[action] (oldfileName, newFileName, path.join (location, file), action);
      return;
    }

    if (isRegExp && oldfileName.test (file) || file === oldfileName) {
      const fileName = isRegExp ? file.replace (oldfileName, newFileName) : newFileName;
      exports[action] (path.join (location, file), path.join (location, fileName));
    }
  });
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

  if (stats.isFile () || stats.isSymbolicLink ()) {
    cpFile (src, dest);
  } else if (stats.isDirectory ()) {
    exports.mkdir (dest);
    fs.readdirSync (src).forEach (function (item) {
      exports.cp (path.join (src, item), path.join (dest, item));
    });
  }
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

  if (stats.isFile () || stats.isSymbolicLink ()) {
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

exports.batch.cp = function (oldFileName, newFileName, location) {
  batch (oldFileName, newFileName, location, 'cp');
};

exports.batch.mv = function (oldFileName, newFileName, location) {
  batch (oldFileName, newFileName, location, 'mv');
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
    if (st.isDirectory ()) {
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

exports.lsall = function (location) {
  const listIn = fs.readdirSync (location);
  let listOut = [];

  listIn.forEach (function (item) {
    const entry = path.join (location, item);
    listOut.push (entry);
    const st = fs.statSync (entry);
    if (st.isDirectory ()) {
      listOut = listOut.concat (exports.lsall (entry));
    }
  });

  return listOut;
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

exports.sed = function (file, regex, newValue) {
  var isBin = isBinaryFile.sync (file);
  if (isBin) {
    return false;
  }

  let data = fs.readFileSync (file).toString ();
  if (!regex.test (data)) {
    return false;
  }

  data = data.replace (regex, newValue);
  fs.writeFileSync (file, data);
  return true;
};
