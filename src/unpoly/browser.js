/*-
Browser interface
=================

We tunnel some browser APIs through this module for easier mocking in tests.

@module up.browser
*/
up.browser = (function() {
  const u = up.util

  /*-
  Submits the given form with a full page load.
  
  For mocking in specs.

  @function up.browser.submitForm
  @internal
  */
  function submitForm(form) {
    form.submit()
  }

  function isIE11() {
    return 'ActiveXObject' in window // this is undefined, but the key is set
  }

  function isEdge18() {
    // Edge 18: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582
    // Edge 92: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36 Edg/92.0.902.78
    return u.contains(navigator.userAgent, ' Edge/')
  }

  /*-
  Returns whether this browser supports manipulation of the current URL
  via [`history.pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState).

  When `pushState`  (e.g. through [`up.follow()`](/up.follow)), it will gracefully
  fall back to a full page load.

  Note that Unpoly will not use `pushState` if the initial page was loaded with
  a request method other than GET.

  @function up.browser.canPushState
  @return {boolean}
  @internal
  */
  function canPushState() {
    // We cannot use pushState if the initial request method is a POST for two reasons:
    //
    // 1. Unpoly replaces the initial state so it can handle the pop event when the
    //    user goes back to the initial URL later. If the initial request was a POST,
    //    Unpoly will wrongly assumed that it can restore the state by reloading with GET.
    //
    // 2. Some browsers have a bug where the initial request method is used for all
    //    subsequently pushed states. That means if the user reloads the page on a later
    //    GET state, the browser will wrongly attempt a POST request.
    //    This issue affects Safari 9 and 10 (last tested in 2017-08).
    //    Modern Firefoxes, Chromes and IE10+ don't have this behavior.
    //
    // The way that we work around this is that we don't support pushState if the
    // initial request method was anything other than GET (but allow the rest of the
    // Unpoly framework to work). This way Unpoly will fall back to full page loads until
    // the framework was booted from a GET request.
    return history.pushState && up.protocol.initialRequestMethod() === 'GET'
  }

  /*-
  Returns whether this browser supports promises.

  @function up.browser.canPromise
  @return {boolean}
  @internal
  */
  function canPromise() {
    return !!window.Promise
  }

  const canFormatLog = u.negate(isIE11)

  const canPassiveEventListener = u.negate(isIE11)

  // Don't memoize so a build may publish window.jQuery after Unpoly was loaded
  function canJQuery() {
    return !!window.jQuery
  }

  const canEval = u.memoize(function() {
    try {
      // Don't use eval() which would prevent minifiers from compressing local variables.
      return new Function('return true')()
    } catch {
      // With a strict CSP this will be an error like:
      // Uncaught EvalError: call to Function() blocked by CSP
      return false
    }
  })

  // IE11: Use the browser.cookies API instead.
  function popCookie(name) {
    let value = document.cookie.match(new RegExp(name+"=(\\w+)"))?.[1]
    if (value) {
      document.cookie = name + '=;Max-Age=0;Path=/'
      return value
    }
  }

  const getJQuery = function() {
    if (!canJQuery()) {
      up.fail('jQuery must be published as window.jQuery')
    }
    return jQuery
  }

  /*-
  @return {boolean}
  @function up.browser.ensureConfirmed
  @param {string} options.confirm
  @param {boolean} options.preload
  @internal
  */
  function assertConfirmed(options) {
    const confirmed = !options.confirm || window.confirm(options.confirm)
    if (!confirmed) {
      throw up.error.aborted('User canceled action')
    }
    return true
  }

  return {
    submitForm,
    canPushState,
    canFormatLog,
    canPassiveEventListener,
    canJQuery,
    canPromise,
    canEval,
    assertConfirmed,
    popCookie,
    get jQuery() { return getJQuery() },
    isIE11,
    isEdge18,
  }
})()
