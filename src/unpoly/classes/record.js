const u = up.util

up.Record = class Record {

  keys() {
    throw 'Return an array of keys'
  }

  defaults(_options) {
    return {}
  }

  constructor(options) {
    u.assign(this, this.defaults(options), this.attributes(options))
  }

  attributes(source = this) {
    return u.pick(source, this.keys())
  }

  [u.copy.key]() {
    return this.variant()
  }

  variant(changes = {}) {
    return new this.constructor(u.merge(this.attributes(), changes))
  }

  [u.isEqual.key](other) {
    return (this.constructor === other.constructor) && u.isEqual(this.attributes(), other.attributes())
  }
}
