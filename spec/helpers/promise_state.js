// We would prefer to use Promise.race() here.
// Unfortunately Promise.race() converts *all* non-native thenables to native Promises
// using Promise.resolve(). This way the thenable takes another microtask tick to fulfill,
// and can never win the race.
window.raceThenables = function(promises) {
  return new Promise(function(resolve, reject) {
    var finished = false

    promises.forEach(function(promise) {
      promise.then(function(value) {
        if (!finished) {
          finished = true
          resolve(value)
        }
      })
      promise.catch(function(value) {
        if (!finished) {
          finished = true
          reject(value)
        }
      })
    })
  })
}

window.promiseState = function(promise) {
  var uniqueValue = window['Symbol'] ? Symbol('unique') : Math.random().toString(36)

  function notifyPendingOrResolved(value) {
    if (value === uniqueValue) {
      return Promise.resolve({ state: 'pending' })
    } else {
      return Promise.resolve({ state: 'fulfilled', value: value })
    }
  }

  function notifyRejected(reason) {
    return Promise.resolve({ state: 'rejected', value: reason })
  }

  var race = [promise, Promise.resolve(uniqueValue)]

  return raceThenables(race).then(notifyPendingOrResolved, notifyRejected)
}
