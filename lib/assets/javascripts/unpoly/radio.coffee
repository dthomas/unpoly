###**
Passive updates
===============

This work-in-progress package will contain functionality to
passively receive updates from the server.

@module up.radio
###
up.radio = do ->

  u = up.util
  e = up.element

  ###**
  Configures defaults for passive updates.

  @property up.radio.config
  @param {Array<string>} [config.hungrySelectors]
    An array of CSS selectors that is replaced whenever a matching element is found in a response.
    These elements are replaced even when they were not targeted directly.

    By default this contains the [`[up-hungry]`](/up-hungry) attribute.
  @stable
  ###
  config = new up.Config ->
    hungrySelectors: ['[up-hungry]']
    pollInterval: 30000

  up.legacy.renamedProperty(config, 'hungry', 'hungrySelectors')

  reset = ->
    config.reset()

  ###**
  @function up.radio.hungrySelector
  @internal
  ###
  hungrySelector = ->
    config.hungrySelectors.join(',')

  ###**
  Elements with an `[up-hungry]` attribute are [updated](/up.replace) whenever there is a
  matching element found in a successful response. The element is replaced even
  when it isn't [targeted](/a-up-target) directly.

  Use cases for this are unread message counters or notification flashes.
  Such elements often live in the layout, outside of the content area that is
  being replaced.

  @selector [up-hungry]
  @param [up-transition]
    The transition to use when this element is updated.
  @stable
  ###

  # TODO: Doku for up.radio.poll()
  poll = (element, options = {}) ->
    interval = options.interval ? e.numberAttr(element, 'up-poll') ? config.pollInterval
    timer = null

    doReload = ->
      reloadDone = if document.hidden then Promise.resolve() else up.reload(element)
      u.always(reloadDone, doSchedule)

    doSchedule = ->
      timer = setTimeout(doReload, interval)

    doSchedule()
    return -> clearTimeout(timer)

  ###**
  Elements with an `[up-poll]` attribute are [reloaded](/up.reload) from the server periodically.

  \#\#\# Example

      <div class="unread-count" up-poll>
        2 new messages
      </div>

  \#\#\# Controlling the reload interval

  The optional value of the `[up-poll]` attribute is the reload interval in milliseconds:

      <div class="unread-count" up-poll="10000">
        2 new messages
      </div>

  If the value is omitted, a global default is used. You may configure the default like this:

      up.radio.config.pollInterval = 10000

  @selector [up-poll]
  @param [up-poll]
    The reload interval in milliseconds.
    Defaults to [`up.radio.config.pollInterval`](/up.radio.config#config.pollInterval).
  @param [up-source]
    The URL from which to reload the fragment.
    Defaults to the URL from which this fragment was originally loaded.
  ###
  up.compiler '[up-poll]', poll

  up.on 'up:framework:reset', reset

  config: config
  hungrySelector: hungrySelector
  poll: poll
