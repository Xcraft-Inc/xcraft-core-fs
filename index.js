'use strict';

const path = require('path');
const crypto = require('crypto');
const fse = require('fs-extra');
const isBinaryFile = require('isbinaryfile');

exports.batch = {};

var cpFile = function (src, dest) {
  const st = fse.lstatSync(src);
  const fMode = st.mode;

  if (st.isSymbolicLink()) {
    const link = fse.readlinkSync(src);
    try {
      fse.removeSync(dest);
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
    fse.symlinkSync(link, dest);
    return;
  }

  var fdr = fse.openSync(src, 'r');
  var fdw = fse.openSync(dest, 'w');
  var bytesRead = 1;
  var pos = 0;

  var BUF_LENGTH = 64 * 1024;
  var buf = Buffer.alloc(BUF_LENGTH);

  while (bytesRead > 0) {
    bytesRead = fse.readSync(fdr, buf, 0, BUF_LENGTH, pos);
    fse.writeSync(fdw, buf, 0, bytesRead);
    pos += bytesRead;
  }

  fse.closeSync(fdr);
  fse.closeSync(fdw);
  fse.chmodSync(dest, fMode);
};

var batch = function (cb, location, action) {
  var files = exports.ls(location);

  files.forEach(function (file) {
    var st = fse.lstatSync(path.join(location, file));
    if (st.isDirectory()) {
      exports.batch[action](cb, path.join(location, file), action);
      return;
    }

    const fileName = cb(location, file);
    if (fileName) {
      exports[action](path.join(location, file), path.join(location, fileName));
    }
  });
};

exports.mkdir = function (location, root) {
  var dirs = location.split(path.sep);
  var dir = dirs.shift();
  root = (root || '') + dir + path.sep;

  try {
    fse.mkdirSync(root);
  } catch (err) {
    if (!fse.statSync(root).isDirectory()) {
      throw new Error(err);
    }
  }

  return !dirs.length || exports.mkdir(dirs.join(path.sep), root);
};

/**
 * Copy a file or the content of a directory.
 *
 * Examples:
 *   `cp ('indir/infile', 'outdir/outfile');`
 *   - The file is copied and renamed. When the source is a file, the
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
  var stats = fse.lstatSync(src);

  if (stats.isFile() || stats.isSymbolicLink()) {
    exports.mkdir(path.dirname(dest));
    cpFile(src, dest);
  } else if (stats.isDirectory()) {
    exports.mkdir(dest);
    fse.readdirSync(src).forEach(function (item) {
      exports.cp(path.join(src, item), path.join(dest, item));
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
  var stats = fse.lstatSync(src);

  if (stats.isFile() || stats.isSymbolicLink()) {
    exports.mkdir(path.dirname(dest));
    fse.renameSync(src, dest);
  } else if (stats.isDirectory()) {
    exports.mkdir(dest);
    fse.readdirSync(src).forEach(function (item) {
      try {
        /* Try the faster move. */
        fse.renameSync(path.join(src, item), path.join(dest, item));
      } catch (ex) {
        /* Or use a copy / rm if it fails. */
        exports.cp(path.join(src, item), path.join(dest, item));
        exports.rm(path.join(src, item));
      }
    });

    exports.rm(src);
  }
};

exports.batch.cp = function (cb, location) {
  batch(cb, location, 'cp');
};

exports.batch.mv = function (cb, location) {
  batch(cb, location, 'mv');
};

exports.rmSymlinks = function (location) {
  const stats = fse.lstatSync(location);

  if (stats.isSymbolicLink()) {
    exports.rm(location);
  } else if (stats.isDirectory()) {
    fse.readdirSync(location).forEach((item) => {
      exports.rmSymlinks(path.join(location, item));
    });
  }
};

exports.rmFiles = function (location) {
  const stats = fse.lstatSync(location);

  if (stats.isFile() || stats.isSymbolicLink()) {
    exports.rm(location);
  } else if (stats.isDirectory()) {
    fse.readdirSync(location).forEach((item) => {
      exports.rmFiles(path.join(location, item));
    });
  }
};

exports.rm = function (location) {
  fse.removeSync(location);
};

exports.lsdir = function (location, regex) {
  var listIn = fse.readdirSync(location);
  var listOut = [];

  listIn.forEach(function (item) {
    if (regex && !regex.test(item)) {
      return;
    }

    var dir = path.join(location, item);
    var st = fse.statSync(dir);
    if (st.isDirectory()) {
      listOut.push(item);
    }
  });

  return listOut;
};

exports.ls = function (location, regex) {
  var listIn = fse.readdirSync(location);
  var listOut = [];

  listIn.forEach(function (item) {
    if (regex && !regex.test(item)) {
      return;
    }

    listOut.push(item);
  });

  return listOut;
};

exports.lsall = function (location, followSymlink = false) {
  const listIn = fse.readdirSync(location);
  let listOut = [];

  listIn.forEach(function (item) {
    const entry = path.join(location, item);
    listOut.push(entry);
    let st = null;
    try {
      st = followSymlink ? fse.statSync(entry) : fse.lstatSync(entry);
    } catch (ex) {
      /* Ignore unsupported paths, only directories are useful here  */
    }
    if (st && st.isDirectory()) {
      listOut = listOut.concat(exports.lsall(entry, followSymlink));
    }
  });

  return listOut;
};

exports.canExecute = function (file) {
  var mask = 1;
  var st;

  try {
    st = fse.statSync(file);
  } catch (err) {
    return false;
  }

  return !!(mask & parseInt((st.mode & parseInt('777', 8)).toString(8)[0]));
};

exports.newerFiles = function (location, regex, mtime) {
  var listIn = fse.readdirSync(location);

  return listIn.some(function (item) {
    if (regex && !regex.test(item)) {
      return;
    }

    var file = path.join(location, item);
    var st = fse.lstatSync(file);

    if (st.isDirectory()) {
      return exports.newerFiles(file, regex, mtime);
    }

    return st.mtime > mtime;
  });
};

exports.shasum = function (location, regex, sha = null) {
  const listIn = fse.readdirSync(location);

  let main = false;
  if (!sha) {
    sha = crypto.createHash('sha256');
    main = true;
  }

  listIn.forEach((item) => {
    if (regex && !regex.test(item)) {
      return;
    }

    const file = path.join(location, item);
    const st = fse.lstatSync(file);

    if (st.isDirectory()) {
      exports.shasum(file, regex, sha);
      return;
    }

    let data;
    if (st.isSymbolicLink()) {
      data = fse.readlinkSync(file);
    } else {
      data = fse.readFileSync(file);
    }

    sha.update(data);
  });

  if (main) {
    return sha.digest('hex');
  }
};

exports.sed = function (file, regex, newValue) {
  var isBin = isBinaryFile.sync(file);
  if (isBin) {
    return false;
  }

  let data = fse.readFileSync(file).toString();
  if (!regex.test(data)) {
    return false;
  }

  data = data.replace(regex, newValue);
  fse.writeFileSync(file, data);
  return true;
};
