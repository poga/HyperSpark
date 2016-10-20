const through2 = require('through2')
const _ = require('highland')

function RDD (archive, parent, transform) {
  if (!(this instanceof RDD)) return new RDD(archive, parent, transform)

  this._archive = archive
  this._parent = parent
  this._transform = transform // transform is a stream, which will be applied to each file
}

RDD.prototype.type = function () {
  return this._transform ? this._transform.returnType : 'T'
}

RDD.prototype.transform = function (transform) {
  // if (!transform.accept(this.type())) throw new Error(`TypeError: ${transform.name} cannot be used on ${this.type()}`)

  return new RDD(null, this, transform)
}

// do action
// evaluation transformation chain. Then apply a transform to each file, then apply a transform to flattened data
RDD.prototype.action = function (fileAction, totalAction) {
  return this._applyTransform()
    .pipe(mapToFilePipe(fileAction))
    .flatten()
    .pipe(pipe(totalAction))
}

// build a transformation chain without evaluating it
RDD.prototype._applyTransform = function () {
  if (this._parent) {
    return mapToFile(this._transform)(this._parent._applyTransform())
  }

  return this._eachFile()
}

// eachFile returns a stream of stream, each inner stream is a fileReadStream
// all stream is wrapped with highland
RDD.prototype._eachFile = function () {
  var archive = this._archive
  return _(archive.list({live: false}).pipe(through2.obj(function (entry, enc, cb) {
    this.push(_(archive.createFileReadStream(entry)))
    cb()
  })))
}

module.exports = RDD

function mapToFilePipe (action) {
  return pipe(_.map(file => action(file)))
}

function pipe (action) {
  return _.pipeline(action)
}

function mapToFile (transform) {
  return _.map(file => transform(file))
}
