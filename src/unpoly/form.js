/*-
Forms
=====
  
The `up.form` module helps you work with non-trivial forms.

@see form[up-submit]
@see form[up-validate]
@see input[up-switch]
@see form[up-autosubmit]

@module up.form
*/
up.form = (function() {

  const u = up.util
  const e = up.element

  const ATTRIBUTES_SUGGESTING_SUBMIT = ['[up-submit]', '[up-target]', '[up-layer]', '[up-transition]']

  /*-
  Sets default options for form submission and validation.

  @property up.form.config

  @param {boolean} [config.disable=false]
    Whether to [disable](/up.form.disable) forms while they are submitting.

  @param {number} [config.observeDelay=0]
    The number of miliseconds to wait before [`up.observe()`](/up.observe) runs the callback
    after the input value changes.

    You may use this option to limit how often the callback will run for a fast typist.

  @param {string} [config.observeEvents]
    An array of event types used when [observing](/up.observe) a form field.

  @param {Array<string>} [config.submitSelectors]
    An array of CSS selectors matching forms that will be [submitted through Unpoly](/form-up-submit).

    You can configure Unpoly to handle *all* forms on a page without requiring an `[up-submit]` attribute:

    ```js
    up.form.config.submitSelectors.push('form')
    ```

    Individual forms may opt out with an `[up-submit=follow]` attribute.
    You may configure additional exceptions in `config.noSubmitSelectors`.

  @param {Array<string>} [config.noSubmitSelectors]
    Exceptions to `config.submitSelectors`.

    Matching forms will *not* be [submitted through Unpoly](/form-up-submit), even if they match `config.submitSelectors`.

  @param {Array<string>} [config.groupSelectors=['[up-form-group]', 'fieldset', 'label', 'form']]
    An array of CSS selectors matching a [form group](/up-form-group).

  @param {string} [config.fieldSelectors]
    An array of CSS selectors that represent form fields, such as `input` or `select`.

    When you add custom JavaScript controls to this list, matching elements should respond to the properties `{ name, value, disabled }`.

  @param {string} [config.submitButtonSelectors]
    An array of CSS selectors that represent submit buttons, such as `input[type=submit]`.

  @stable
   */
  const config = new up.Config(() => ({
    groupSelectors: ['[up-form-group]', 'fieldset', 'label', 'form'],
    fieldSelectors: ['select', 'input:not([type=submit]):not([type=image])', 'button[type]:not([type=submit])', 'textarea'],
    submitSelectors: up.link.combineFollowableSelectors(['form'], ATTRIBUTES_SUGGESTING_SUBMIT),
    noSubmitSelectors: ['[up-submit=false]', '[target]'],
    submitButtonSelectors: ['input[type=submit]', 'input[type=image]', 'button[type=submit]', 'button:not([type])'],

    // submitOptions: { // Orthogonal to navigate? But submit is always navigation.
    //   disable: false,
    //   sequence: 'form',
    // },
    //
    // observeOptions: {
    //   event: 'input change',
    //   delay: 0,
    //   feedback: undefined, // TODO: document, but remove undefined options
    //   disable: undefined, // TODO: document, but remove undefined options
    //   // sequence: undefined,
    // },
    //
    // validateOptions: {
    //   event: ,
    //   delay: 0,
    //   feedback: undefined, // TODO: document, but remove undefined options
    //   disable: undefined, // TODO: document, but remove undefined options
    //   // sequence: undefined,
    // },

    // Although we only need to bind to `input, we always also bind to `change`
    // in case another script manually triggers it.
    inputEvent: 'input change',
    inputDelay: 0,
    changeEvent: (field) => e.matches(field, 'input[type=date]') ? 'blur' : 'change',
    disable: false,
    feedback: undefined,

  }))

  function fullSubmitSelector() {
    return config.submitSelectors.join(',')
  }

  function reset() {
    config.reset()
  }

  /*-
   @function up.form.fieldSelector
   @internal
   */
  function fieldSelector(suffix = '') {
    return config.fieldSelectors.map(field => field + suffix).join(',')
  }

  function isField(element) {
    return e.matches(element, fieldSelector())
  }

  /*-
  Returns a list of form fields within the given element.

  You can configure what Unpoly considers a form field by adding CSS selectors to the
  `up.form.config.fieldSelectors` array.

  If the given element is itself a form field, a list of that given element is returned.

  @function up.form.fields
  @param {Element|jQuery} root
    The element to scan for contained form fields.

    If the element is itself a form field, a list of that element is returned.
  @return {List<Element>}

  @experimental
  */
  function findFields(root) {
    root = e.get(root); // unwrap jQuery
    let fields = e.subtree(root, fieldSelector())

    // If findFields() is called with an entire form, gather fields outside the form
    // element that are associated with the form (through <input form="id-of-form">, which
    // is an HTML feature.)
    if (e.matches(root, 'form[id]')) {
      const outsideFieldSelector = fieldSelector(e.attributeSelector('form', root.getAttribute('id')))
      const outsideFields = up.fragment.all(outsideFieldSelector, { layer: root })
      fields.push(...outsideFields)
      fields = u.uniq(fields)
    }

    return fields
  }

  // function findFieldBatches(root) {
  //   let fields = findFields(root)
  //   let fieldsByName = u.groupBy(fields, 'name')
  //   return u.values(fieldsByNames)
  // }

  /*-
  Returns a list of submit buttons within the given element.

  You can configure what Unpoly considers a submit button by adding CSS selectors to the
  `up.form.config.submitButtonSelectors` array.

  @function up.form.submitButtons
  @param {Element|jQuery} root
    The element to scan for contained submit buttons.
  @return {List<Element>}

  @experimental
  */
  function findSubmitButtons(root) {
    return e.subtree(root, submitButtonSelector())
  }

  /*-
  @function up.form.submittingButton
  @param {Element} form
  @internal
  */
  function submittingButton(form) {
    const selector = submitButtonSelector()
    const focusedElement = document.activeElement
    if (focusedElement && e.matches(focusedElement, selector) && form.contains(focusedElement)) {
      return focusedElement
    } else {
      // If no button is focused, we assume the first button in the form.
      return e.get(form, selector)
    }
  }

  /*-
  @function up.form.submitButtonSelector
  @internal
  */
  function submitButtonSelector() {
    return config.submitButtonSelectors.join(',')
  }

  /*-
  Submits a form via AJAX and updates a page fragment with the response.

  Instead of loading a new page, the form is submitted via AJAX.
  The response is parsed for a CSS selector and the matching elements will
  replace corresponding elements on the current page.

  The unobtrusive variant of this is the `form[up-submit]` selector.
  See its documentation to learn how form submissions work in Unpoly.

  Submitting a form is considered [navigation](/navigation).

  Emits the event [`up:form:submit`](/up:form:submit).

  ### Example

  ```js
  up.submit('form.new-user', { target: '.main' })
  ```

  @function up.submit

  @param {Element|jQuery|string} form
    The form to submit.

    If the argument points to an element that is not a form,
    Unpoly will search its ancestors for the [closest](/up.fragment.closest) form.

  @param {Object} [options]
    [Render options](/up.render) that should be used for submitting the form.

    Unpoly will parse render options from the given form's attributes
    like `[up-target]` or `[up-transition]`. See `form[up-submit]` for a list
    of supported attributes.

    You may pass this additional `options` object to supplement or override
    options parsed from the form attributes.

  @param {boolean} [options.navigate=true]
    Whether this fragment update is considered [navigation](/navigation).

    Setting this to `false` will disable most defaults.

  @return {Promise<up.RenderResult>}
    A promise that will be fulfilled when the server response was rendered.

  @stable
  */
  const submit = up.mockable((form, options) => {
    return up.render(submitOptions(form, options))
  })

  /*-
  Parses the [render](/up.render) options that would be used to
  [`submit`](/up.submit) the given form, but does not render.

  ### Example

  Given a form element:

  ```html
  <form action="/foo" method="post" up-target=".content">
  ...
  </form>
  ```

  We can parse the link's render options like this:

  ```js
  let form = document.querySelector('form')
  let options = up.form.submitOptions(form)
  // => { url: '/foo', method: 'POST', target: '.content', ... }
  ```

  @param {Element|jQuery|string} form
    The form for which to parse render option.
  @param {Object} [options]
    Additional options for the form submission.

    Will override any attribute values set on the given form element.

    See `up.render()` for detailed documentation of individual option properties.
  @function up.form.submitOptions
  @return {Object}
  @stable
  */
  function submitOptions(form, options, parserOptions) {
    form = getForm(form)
    parserOptions = u.options(parserOptions, { defaults: defaultSubmitOptions() })
    options = parseDestinationOptions(form, options, parserOptions)

    let parser = new up.OptionsParser(form, options, parserOptions)
    parser.string('failTarget', { default: up.fragment.toTarget(form) })
    parser.boolean('disable')

    // The guardEvent will also be assigned an { renderOptions } property in up.render()
    options.guardEvent ||= up.event.build('up:form:submit', {
      submitButton: options.submitButton,
      params: options.params,
      log: 'Submitting form'
    })

    // Now that we have extracted everything form-specific into options, we can call
    // up.link.followOptions(). This will also parse the myriads of other options
    // that are possible on both <form> and <a> elements.
    u.assign(options, up.link.followOptions(form, options, parserOptions))

    return options
  }

  function observeOptions(field, options, parserOptions) {
    let parser = new up.OptionsParser(field, options, { closest: true, attrPrefix: 'up-observe-', ...parserOptions })

    // Computing the effective options for a given field is pretty involved,
    // as there are multiple layers of defaults.
    //
    // Form-wide options are also used for observers:
    //
    // 		<form up-disable="true">
    // 			<input up-autosubmit>
    // 		</form>
    //
    // Form-wide options can be overridden at the input level:
    //
    // 		<form up-disable="true">
    // 			<input up-autosubmit up-observe-disable="false">
    // 		</form>
    //
    // Forms can configure a separate option for all observers:
    //
    // 		<form up-disable="true" up-observe-disable="false">
    // 			<input up-autosubmit>
    // 		</form>
    //
    // Radio buttons are grouped within a container that has all the options.
    // There are no options at individual inputs:
    //
    // 		<form up-disable="true">
    // 			<div up-form-group up-autosubmit up-observe-disable="false">
    // 				<input type="radio" name="kind" value="0">
    // 				<input type="radio" name="kind" value="1">
    // 				<input type="radio" name="kind" value="2">
    // 			</div>
    // 		</form>
    //
    // Users can configure app-wide defaults:
    //
    // 		up.form.config.inputDelay = 100
    //
    // Summing up, we get an option like { disable } through the following priorities:
    //
    // 1. Passed as explicit `up.observe({ disable })` option
    // 2. Attribute for the observe intent (e.g. `[up-observe-disable]` at the input or form)
    // 3. Default config for this observe() intent (e.g. `up.form.config.observeOptions.disable`).
    // 4. The option the form would use for regular submission (e.g. `[up-disable]` at the form), if applicable.
    parser.boolean('feedback')
    parser.boolean('disable')
    parser.string('event')
    parser.number('delay')

    let config = up.form.config
    if (options.event === 'input') {
      options.event = u.evalOption(config.inputEvent, field)
      options.delay ??= config.inputDelay
    } else if (options.event === 'change') {
      options.event = u.evalOption(config.changeEvent, field)
    }

    options.origin ||= field

    return options
  }

  function defaultSubmitOptions() {
    return u.pick(config, ['disable', 'feedback']) // TODO: 'sequence'
  }

  /*-
  Disables all [fields](/up.form.fields) and [submit buttons](/up.form.submitButtons) within the given element.

  Disabling a focused control may cause focus to be reset. To prevent this, Unpoly will
  focus the closest [form group](/up-form-group) around the disabled control.

  To automatically disable a form when it is submitted, add the [`[up-disable]`](/form-up-submit#up-disable)
  property to the `<form>` element.

  @function up.form.disable
  @param {Element} element
    The element within which fields and buttons should be disabled.
  @return {Function}
    A function that re-enables the elements that were disabled.
  @experimental
  */
  function disableContainer(container) {
    let focusedElement = document.activeElement
    let focusFallback
    let mayLoseFocus = container.contains(focusedElement)
    if (mayLoseFocus) {
      let focusedGroup = findGroup(focusedElement)
      // (1) If the field's form group is closer than the container, we should restore focus there.
      // (2) If we're disabling the focused element directly, we should focus the group.
      if (container.contains(focusedGroup) || container === focusedElement) {
        focusFallback = focusedGroup
      } else {
        focusFallback = container
      }
    }

    let controls = [...findFields(container), ...findSubmitButtons(container)]
    controls = u.reject(controls, 'disabled')
    setControlsDisabled(controls, true)

    if (focusFallback && !focusFallback.contains(document.activeElement)) {
      up.focus(focusFallback, { force: true, preventScroll: true })
    }

    return () => setControlsDisabled(controls, false)
  }

  function setControlsDisabled(controls, disabled) {
    for (let control of controls) {
      control.disabled = disabled
    }
  }

  function disableAroundRequest(request, options) {
    if (options.disable && options.origin) {
      let form = getForm(options.origin)
      let undoDisable = disableContainer(form)
      u.always(request, undoDisable)
    }
  }

  // This was extracted from submitOptions().
  // Validation needs to submit a form without options intended for the final submission,
  // like [up-scroll], [up-confirm], etc.
  function parseDestinationOptions(form, options, parserOptions) {
    options = u.options(options)
    form = getForm(form)
    const parser = new up.OptionsParser(form, options, parserOptions)

    parser.string('contentType', { attr: ['enctype', 'up-content-type'] })
    parser.json('headers')

    parser.process('params', function() {
      // Parse params from form fields.
      const params = up.Params.fromForm(form)

      const submitButton = submittingButton(form)
      if (submitButton) {
        options.submitButton = submitButton
        // Submit buttons with a [name] attribute will add to the params.
        // Note that addField() will only add an entry if the given button has a [name] attribute.
        params.addField(submitButton)

        // Submit buttons may have [formmethod] and [formaction] attribute
        // that override [method] and [action] attribute from the <form> element.
        options.method ||= submitButton.getAttribute('formmethod')
        options.url ||= submitButton.getAttribute('formaction')
        options.origin ||= submitButton
      }

      // We had any { params } option to the params that we got from the form.
      params.addAll(options.params)
      options.params = params
    })

    // Parse the form element's { url, method } *after* parsing the submit button.
    // The submit button's [formmethod] and [formaction] attributes have precedence.
    parser.string('url', { attr: 'action', default: up.fragment.source(form) })
    parser.string('method', {
      attr: ['up-method', 'data-method', 'method'],
      default: 'GET',
      normalize: u.normalizeMethod
    })
    if (options.method === 'GET') {
      // Only for GET forms, browsers discard all query params from the form's [action] URL.
      // The URLs search part will be replaced with the serialized form data.
      // See design/query-params-in-form-actions/cases.html for
      // a demo of vanilla browser behavior.
      options.url = up.Params.stripURL(options.url)
    }

    return options
  }

  /*-
  This event is [emitted](/up.emit) when a form is [submitted](/up.submit) through Unpoly.

  The event is emitted on the `<form>` element.

  When the form is being [validated](/input-up-validate), this event is not emitted.
  Instead an `up:form:validate` event is emitted.

  ### Changing render options

  Listeners may inspect and manipulate [render options](/up.render) for the coming fragment update.

  The code below will use a custom [transition](/a-up-transition)
  when a form submission [fails](/server-errors):

  ```js
  up.on('up:form:submit', function(event, form) {
    event.renderOptions.failTransition = 'shake'
  })
  ```

  @event up:form:submit
  @param {Element} event.target
    The `<form>` element that will be submitted.
  @param {up.Params} event.params
    The [form parameters](/up.Params) that will be send as the form's request payload.
  @param {Element} [event.submitButton]
    The button used to submit the form.
  @param {Object} event.renderOptions
    An object with [render options](/up.render) for the fragment update.

    Listeners may inspect and modify these options.
  @param event.preventDefault()
    Event listeners may call this method to prevent the form from being submitted.
  @stable
  */

  // MacOS does not focus buttons on click.
  // That means that submittingButton() cannot rely on document.activeElement.
  // See https://github.com/unpoly/unpoly/issues/103
  up.on('up:click', submitButtonSelector, function (event, button) {
    // Don't mess with focus unless we know that we're going to handle the form.
    // https://groups.google.com/g/unpoly/c/wsiATxepVZk
    const form = getForm(button)
    if (form && isSubmittable(form)) {
      button.focus()
    }
  })

  /*-
  Observes form fields and runs a callback when a value changes.

  This is useful for observing text fields while the user is typing.

  The unobtrusive variant of this is the [`[up-observe]`](/input-up-observe) attribute.

  ### Example

  The following would print to the console whenever an input field changes:

  ```js
  up.observe('input.query', function(value) {
    console.log('Query is now %o', value)
  })
  ```

  Instead of a single form field, you can also pass multiple fields,
  a `<form>` or any container that contains form fields.
  The callback will be run if any of the given fields change:

  ```js
  up.observe('form', function(value, name) {
   console.log('The value of %o is now %o', name, value)
  })
  ```

  You may also pass the `{ batch: true }` option to receive all
  changes since the last callback in a single object:

  ```js
  up.observe('form', { batch: true }, function(diff) {
   console.log('Observed one or more changes: %o', diff)
  })
  ```

  @function up.observe
  @param {string|Element|Array<Element>|jQuery} elements
    The form fields that will be observed.

    You can pass one or more fields, a `<form>` or any container that contains form fields.
    The callback will be run if any of the given fields change.
  @param {boolean} [options.batch=false]
    If set to `true`, the `onChange` callback will receive multiple
    detected changes in a single diff object as its argument.
  @param {number} [options.delay=up.form.config.observeDelay]
    The number of miliseconds to wait before executing the callback
    after the input value changes.

    You may use this option to limit how often the callback will run for a fast typist.

    If form is submitted during the delay, the callback will not run.
  @param {Function(value, name): string} onChange
    The callback to run when the field's value changes.

    If given as a function, it receives two arguments (`value`, `name`).
    `value` is a string with the new attribute value and `string` is the name
    of the form field that changed. If given as a string, it will be evaled as
    JavaScript code in a context where (`value`, `name`) are set.

    A long-running callback function may return a promise that settles when
    the callback completes. In this case the callback will not be called again while
    it is already running.
  @return {Function()}
    A destructor function that removes the observe watch when called.

    Observing will stop automatically when the targeted fields are removed from the DOM.
  @stable
  */
  function observe(container, ...args) {
    let form = getForm(container)
    const fields = findFields(container)
    const unnamedFields = u.reject(fields, 'name')
    if (unnamedFields.length) {
      // (1) We do not need to exclude the unnamed fields for up.FieldObserver, since that
      //     parses values with up.Params.fromFields(), and that ignores unnamed fields.
      // (2) Only warn, don't crash. There are some legitimate cases for having unnamed
      //     a mix of named and unnamed fields in a form, and we don't want to prevent
      //     <form up-observe> in that case.
      up.warn('up.observe()', 'Will not observe fields without a [name]: %o', unnamedFields)
    }
    const callback = u.extractCallback(args) || observeCallbackFromElement(container) || up.fail('No callback given for up.observe()')
    let options = u.extractOptions(args)

    const observer = new up.FieldObserver(form, fields, options, callback)
    observer.start()
    return () => observer.stop()
  }

  function observeCallbackFromElement(element) {
    let rawCallback = element.getAttribute('up-observe')
    if (rawCallback) {
      return up.NonceableCallback.fromString(rawCallback).toFunction('value', 'name')
    }
  }

  /*-
  [Observes](/up.observe) a field or form and submits the form when a value changes.

  Both the form and the changed field will be assigned a CSS class [`.up-active`](/form.up-active)
  while the autosubmitted form is processing.

  The unobtrusive variant of this is the [`[up-autosubmit]`](/form-up-autosubmit) attribute.

  @function up.autosubmit
  @param {string|Element|jQuery} target
    The field or form to observe.
  @param {Object} [options]
    See options for [`up.observe()`](/up.observe)
  @return {Function()}
    A destructor function that removes the observe watch when called.

    Autosubmitting will stop automatically when the targeted fields are removed from the DOM.
  @stable
  */
  function autosubmit(target, options) {
    return observe(target, options, () => submit(target))
  }

  function getGroupSelectors() {
    return up.migrate.migratedFormGroupSelectors?.() || config.groupSelectors
  }

  function getFullGroupSelector() {
    return getGroupSelectors().join(',')
  }

  /*-
  Returns the [form group](/up-form-group) for the given element.

  Form groups may be nested. This function returns the closest group around the given element.

  ### Example

  This is a form with two groups:

  ```html
  <form>
    <div up-form-group>
      <label for="email">E-mail</label>
      <input type="text" name="email" id="email">
    </div>
    <div up-form-group>
      <label for="password">Password</label>
      <input type="text" name="password" id="password">
    </div>
  </form>
  ```

  We can now retrieve the form group for any element in the form:

  ```js
  let passwordField = document.querySelector('#password')
  let group = up.form.group(passwordField) // returns second <fieldset>
  ```

  @function up.form.group
  @param {Element} element
    The element for which to find a form group.
  @return {Element|undefined}
    The closest form group around the given element.

    If no better group can be found, the `form` element is returned.
  @experimental
  */
  function findGroup(field) {
    return findGroupSolution(field).element
  }

  /*-
  Marks this element as a from group, which (usually) contains a label, input and error message.

  You are not required to use form groups to [submit forms through Unpoly](/form-up-submit).
  However, structuring your form into groups will help Unpoly to make smaller changes to the DOM when
  working with complex form. For instance, when [validating](/input-up-validate) a field,
  Unpoly will re-render the closest form group around that field.

  By default Unpoly will also consider a `fieldset` or `label` around a field to be a form group.
  You can configure this in `up.form.config.groupSelectors`.

  ### Example

  Many apps use form groups to wrap a label, input field, error message and help text.

  ```html
  <form>
    <div up-form-group>
      <label for="email">E-mail</label>
      <input type="text" name="email" id="email">
    </div>
    <div up-form-group>
      <label for="password">Password</label>
      <input type="text" name="password" id="password">
      <div class="error">Must be 8 characters or longer</div>
    </div>
  </form>
  ```

  @selector [up-form-group]
  @experimental
  */

  function findGroupSolution(field) {
    return u.findResult(getGroupSelectors(), function(groupSelector) {
      let group = e.closest(field, groupSelector)
      if (group) {
        let target = groupSelector
        if (group !== field) {
          // Most forms have multiple groups with no identifying attributes.
          // Hence we use a :has() selector to identify the form group by the selector
          // of the contained field, which usually has an identifying [name] or [id] attribute.
          target += `:has(${up.fragment.toTarget(field)})`
        }
        return {
          target,
          element: group,
          origin: field
        }
      }
    })
  }

  /*-
  Performs a server-side validation of a form field.

  `up.validate()` submits the given field's form with an additional `X-Up-Validate`
  HTTP header. Upon seeing this header, the server is expected to validate (but not save)
  the form submission and render a new copy of the form with validation errors.

  Unpoly will re-render the closest [form group](/up-form-group) around the validating field.

  The unobtrusive variant of this is the [`input[up-validate]`](/input-up-validate) selector.
  See the documentation for [`input[up-validate]`](/input-up-validate) for more information
  on how server-side validation works in Unpoly.

  ### Example

  ```js
  up.validate('input[name=email]', { target: '.email-errors' })
  ```

  @function up.validate
  @param {string|Element|jQuery} field
    The form field to validate.
  @param {Object} [options]
    Additional [submit options](/up.submit#options) that should be used for
    submitting the form for validation.

    You may pass this `options` object to supplement or override the defaults
    from `up.submit()`.
  @param {string|Element|jQuery} [options.target]
    The element that will be [updated](/up.render) with the validation results.

    By default the closest [form group](/up-form-group)
    around the given `field` is updated.
  @return {Promise}
    A promise that fulfills when the server-side
    validation is received and the form was updated.
  @stable
  */
  function validate(field, options) {
    let validator = up.FormValidator.forElement(field)
    return validator.validate(field, options)
  }

  /*-
  This event is emitted before a form is being [validated](/input-up-validate).

  @event up:form:validate
  @param {Element} event.target
    The form that is being validated.
  @param {Element} event.fields
    The form fields that triggered this validation pass.

    When multiple fields are validating within the same [task](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/),
    Unpoly will make a single validation request with multiple targets.
  @param {Object} event.renderOptions
    An object with [render options](/up.render) for the fragment update
    that will show the validation results.

    Listeners may inspect and modify these options.
  @param event.preventDefault()
    Event listeners may call this method to prevent the validation request
    being sent to the server.
  @stable
  */

  function switcherValues(field) {
    let value
    let meta

    if (e.matches(field, 'input[type=checkbox]')) {
      if (field.checked) {
        value = field.value
        meta = ':checked'
      } else {
        meta = ':unchecked'
      }
    } else if (e.matches(field, 'input[type=radio]')) {
      const form = getContainer(field)
      const groupName = field.getAttribute('name')
      const checkedButton = form.querySelector(`input[type=radio]${e.attributeSelector('name', groupName)}:checked`)
      if (checkedButton) {
        meta = ':checked'
        value = checkedButton.value
      } else {
        meta = ':unchecked'
      }
    } else {
      value = field.value
    }

    const values = []
    if (u.isPresent(value)) {
      values.push(value)
      values.push(':present')
    } else {
      values.push(':blank')
    }
    if (u.isPresent(meta)) {
      values.push(meta)
    }
    return values
  }

  /*-
  Shows or hides a target selector depending on the value.

  See [`input[up-switch]`](/input-up-switch) for more documentation and examples.

  This function does not currently have a very useful API outside
  of our use for `up-switch`'s UJS behavior, that's why it's currently
  still marked `@internal`.

  @function up.form.switchTargets
  @param {Element} switcher
  @param {string} [options.target]
    The target selectors to switch.
    Defaults to an `[up-switch]` attribute on the given field.
  @internal
  */
  function switchTargets(switcher, options = {}) {
    const targetSelector = options.target || options.target || switcher.getAttribute('up-switch')
    const form = getContainer(switcher)
    targetSelector || up.fail("No switch target given for %o", switcher)
    const fieldValues = switcherValues(switcher)

    for (let target of e.all(form, targetSelector)) {
      switchTarget(target, fieldValues)
    }
  }

  const switchTarget = up.mockable(function(target, fieldValues) {
    let show
    fieldValues ||= switcherValues(findSwitcherForTarget(target))

    let hideValues = target.getAttribute('up-hide-for')
    if (hideValues) {
      hideValues = u.splitValues(hideValues)
      show = u.intersect(fieldValues, hideValues).length === 0
    } else {
      let showValues = target.getAttribute('up-show-for')
      // If the target has neither up-show-for or up-hide-for attributes,
      // assume the user wants the target to be visible whenever anything
      // is checked or entered.
      showValues = showValues ? u.splitValues(showValues) : [':present', ':checked']
      show = u.intersect(fieldValues, showValues).length > 0
    }

    e.toggle(target, show)
    target.classList.add('up-switched')
  })

  function findSwitcherForTarget(target) {
    const form = getContainer(target)
    const switchers = e.all(form, '[up-switch]')
    const switcher = u.find(switchers, function(switcher) {
      const targetSelector = switcher.getAttribute('up-switch')
      return e.matches(target, targetSelector)
    })
    return switcher || up.fail('Could not find [up-switch] field for %o', target)
  }

  function getForm(elementOrTarget, fallbackSelector) {
    const element = up.fragment.get(elementOrTarget)

    // Element#form will also work if the element is outside the form with an [form=form-id] attribute
    return element.form || e.closest(element, 'form') || (fallbackSelector && e.closest(element, fallbackSelector))
  }

  function getContainer(element) {
    return getForm(element, up.layer.anySelector())
  }

  function focusedField() {
    return u.presence(document.activeElement, isField)
  }

  /*-
  Returns whether the given form will be [submitted](/up.follow) through Unpoly
  instead of making a full page load.

  By default Unpoly will follow forms if the element has
  one of the following attributes:

  - `[up-submit]`
  - `[up-target]`
  - `[up-layer]`
  - `[up-transition]`

  To consider other selectors to be submittable, see `up.form.config.submitSelectors`.

  @function up.form.isSubmittable
  @param {Element|jQuery|string} form
    The form to check.
  @stable
  */
  function isSubmittable(form) {
    form = up.fragment.get(form)
    return e.matches(form, fullSubmitSelector()) && !isSubmitDisabled(form)
  }

  function isSubmitDisabled(form) {
    // We also don't want to handle cross-origin forms.
    // That will be handled in `up.Change.FromURL#newPageReason`.
    return e.matches(form, config.noSubmitSelectors.join(','))
  }

  /*-
  Submits this form via JavaScript and updates a fragment with the server response.

  The server response is searched for the selector given in `up-target`.
  The selector content is then [replaced](/up.replace) in the current page.

  The programmatic variant of this is the [`up.submit()`](/up.submit) function.

  ### Example

  ```html
  <form method="post" action="/users" up-submit>
    ...
  </form>
  ```

  ### Handling validation errors

  When the server was unable to save the form due to invalid params,
  it will usually re-render an updated copy of the form with
  validation messages.

  For Unpoly to be able to detect a failed form submission,
  the form must be re-rendered with a non-200 HTTP status code.
  We recommend to use either 400 (bad request) or
  422 (unprocessable entity).

  In Ruby on Rails, you can pass a
  [`:status` option to `render`](http://guides.rubyonrails.org/layouts_and_rendering.html#the-status-option)
  for this:

  ```ruby
  class UsersController < ApplicationController

    def create
      user_params = params[:user].permit(:email, :password)
      @user = User.new(user_params)
      if @user.save?
        sign_in @user
      else
        render 'form', status: :bad_request
      end
    end

  end
  ```

  You may define different option for the failure case by infixing an attribute with `fail`:

  ```html
  <form method="post" action="/action"
    up-target=".content"
    up-fail-target="form"
    up-scroll="auto"
    up-fail-scroll=".errors">
    ...
  </form>
  ```

  See [handling server errors](/server-errors) for details.

  Note that you can also use
  [`input[up-validate]`](/input-up-validate) to perform server-side
  validations while the user is completing fields.

  ### Giving feedback while the form is processing

  The `<form>` element will be assigned a CSS class [`.up-active`](/form.up-active) while
  the submission is loading.

  ### Short notation

  You may omit the `[up-submit]` attribute if the form has one of the following attributes:

  - `[up-target]`
  - `[up-layer]`
  - `[up-transition]`

  Such a form will still be submitted through Unpoly.

  ### Handling all forms automatically

  You can configure Unpoly to handle *all* forms on a page without requiring an `[up-submit]` attribute.

  See [Handling all links and forms](/handling-everything).

  @selector form[up-submit]

  @params-note
    All attributes for `a[up-follow]` may be used.

  @param [up-fail-target]
    The CSS selector to update when the server responds with an error code.

    Defaults to the form element itself.

    @see server-errors

  @param [up-disable]
    Whether to [disable](/up.form.disable) this forms while it is submitting.

    With `[up-disable=true]` user input to all forms and buttons will be blocked while the form is waiting for a server response.

    This attribute is ignored when [validating](/input-up-validate).

  @stable
  */

  up.on('submit', fullSubmitSelector, function(event, form) {
    // Users may configure up.form.config.submitSelectors.push('form')
    // and then opt out individual forms with [up-submit=false].
    if (event.defaultPrevented || isSubmitDisabled(form)) {
      return
    }

    up.event.halt(event)
    up.log.muteUncriticalRejection(submit(form))
  })

  /*-
  When a form field with this attribute is changed, the form is validated on the server
  and is updated with validation messages.

  To validate the form, Unpoly will submit the form with an additional `X-Up-Validate` HTTP header.
  When seeing this header, the server is expected to validate (but not save)
  the form submission and render a new copy of the form with validation errors.

  The programmatic variant of this is the [`up.validate()`](/up.validate) function.

  ### Example

  Let's look at a standard registration form that asks for an e-mail and password:

  ```html
  <form action="/users">

    <label>
      E-mail: <input type="text" name="email" />
    </label>

    <label>
      Password: <input type="password" name="password" />
    </label>

    <button type="submit">Register</button>

  </form>
  ```

  When the user changes the `email` field, we want to validate that
  the e-mail address is valid and still available. Also we want to
  change the `password` field for the minimum required password length.
  We can do this by giving both fields an `up-validate` attribute:

  ```html
  <form action="/users">

    <label>
      E-mail: <input type="text" name="email" up-validate />
    </label>

    <label>
      Password: <input type="password" name="password" up-validate />
    </label>

    <button type="submit">Register</button>

  </form>
  ```

  Whenever a field with `up-validate` changes, the form is POSTed to
  `/users` with an additional `X-Up-Validate` HTTP header.
  When seeing this header, the server is expected to validate (but not save)
  the form submission and render a new copy of the form with validation errors.

  In Ruby on Rails the processing action should behave like this:

  ```ruby
  class UsersController < ApplicationController

    * This action handles POST /users
    def create
      user_params = params[:user].permit(:email, :password)
      @user = User.new(user_params)
      if request.headers['X-Up-Validate']
        @user.valid?  # run validations, but don't save to the database
        render 'form' # render form with error messages
      elsif @user.save?
        sign_in @user
      else
        render 'form', status: :bad_request
      end
    end

  end
  ```

  Note that if you're using the `unpoly-rails` gem you can simply say `up.validate?`
  instead of manually checking for `request.headers['X-Up-Validate']`.

  The server now renders an updated copy of the form with eventual validation errors:

  ```ruby
  <form action="/users">

    <label class="has-error">
      E-mail: <input type="text" name="email" value="foo@bar.com" />
      Has already been taken!
    </label>

    <button type="submit">Register</button>

  </form>
  ```

  The `<label>` around the e-mail field is now updated to have the `.has-error`
  class and display the validation message.

  ### How validation results are displayed

  Although the server will usually respond to a validation with a complete,
  fresh copy of the form, Unpoly will only update the closest [form group](/up-form-group)
  around the validating field. If the form is not structured into groups, the entire
  form will be updated.

  You can also override what to update by setting the `[up-validate]`
  attribute to a CSS selector:

  ```html
  <input type="text" name="email" up-validate=".email-errors">
  <span class="email-errors"></span>
  ```

  ### Updating dependent fields

  The `[up-validate]` behavior is also a great way to partially update a form
  when one fields depends on the value of another field.

  Let's say you have a form with one `<select>` to pick a department (sales, engineering, ...)
  and another `<select>` to pick an employeee from the selected department:

  ```html
  <form action="/contracts">
    <select name="department">...</select> <!-- options for all departments -->
    <select name="employeed">...</select> <!-- options for employees of selected department -->
  </form>
  ```

  The list of employees needs to be updated as the appartment changes:

  ```html
  <form action="/contracts">
    <select name="department" up-validate="[name=employee]">...</select>
    <select name="employee">...</select>
  </form>
  ```

  In order to update the `department` field in addition to the `employee` field, you could say
  `up-validate="&, [name=employee]"`, or simply `up-validate="form"` to update the entire form.

  @selector input[up-validate]
  @param up-validate
    The CSS selector to update with the server response.

    This defaults the closest form group around the validating field.
  @stable
  */

  /*-
  Validates this form on the server when any field changes and shows validation errors.

  See `input[up-validate]` for detailed documentation.

  @selector form[up-validate]
  @param up-validate
    The CSS selector to update with the server response.

    This defaults to the closest [form group](/up-form-group)
    around the validating field.
  @stable
  */
  up.compiler(validatingFieldSelector, function(field) {
    let validator = up.FormValidator.forElement(field)
    validator.watchField(field)
  })

  function validatingFieldSelector() {
    return config.fieldSelectors.map((selector) => `${selector}[up-validate], [up-validate] ${selector}`).join(', ')
  }

  /*-
  Show or hide elements when a form field is set to a given value.

  When the controlling form field gets an `up-switch` attribute, and that form field is nested inside a `<form>`
  parent, the targets elements must also be inside that same `<form>` parent.

  ### Example: Select options

  The controlling form field gets an `up-switch` attribute with a selector for the elements to show or hide:

  ```html
  <select name="advancedness" up-switch=".target">
    <option value="basic">Basic parts</option>
    <option value="advanced">Advanced parts</option>
    <option value="very-advanced">Very advanced parts</option>
  </select>
  ```

  The target elements can use [`[up-show-for]`](/up-show-for) and [`[up-hide-for]`](/up-hide-for)
  attributes to indicate for which values they should be shown or hidden:

  ```html
  <div class="target" up-show-for="basic">
    only shown for advancedness = basic
  </div>

  <div class="target" up-hide-for="basic">
    hidden for advancedness = basic
  </div>

  <div class="target" up-show-for="advanced very-advanced">
    shown for advancedness = advanced or very-advanced
  </div>
  ```

  ### Example: Text field

  The controlling `<input>` gets an `up-switch` attribute with a selector for the elements to show or hide:

  ```html
  <input type="text" name="user" up-switch=".target">

  <div class="target" up-show-for="alice">
    only shown for user alice
  </div>
  ```

  You can also use the pseudo-values `:blank` to match an empty input value,
  or `:present` to match a non-empty input value:

  ```html
  <input type="text" name="user" up-switch=".target">

  <div class="target" up-show-for=":blank">
    please enter a username
  </div>
  ```

  ### Example: Checkbox

  For checkboxes you can match against the pseudo-values `:checked` or `:unchecked`:

  ```html
  <input type="checkbox" name="flag" up-switch=".target">

  <div class="target" up-show-for=":checked">
    only shown when checkbox is checked
  </div>

  <div class="target" up-show-for=":unchecked">
    only shown when checkbox is unchecked
  </div>
  ```

  Of course you can also match against the `value` property of the checkbox element:

  ```html
  <input type="checkbox" name="flag" value="active" up-switch=".target">

  <div class="target" up-show-for="active">
    only shown when checkbox is checked
  </div>
  ```

  ### Example: Radio button

  ```html
  <input type="radio" name="advancedness" value="basic" up-switch=".target">
  <input type="radio" name="advancedness" value="advanced" up-switch=".target">
  <input type="radio" name="advancedness" value="very-advanced" up-switch=".target">

  <div class="target" up-show-for="basic">
    only shown for advancedness = basic
  </div>

  <div class="target" up-hide-for="basic">
    hidden for advancedness = basic
  </div>

  <div class="target" up-show-for="advanced very-advanced">
    shown for advancedness = advanced or very-advanced
  </div>
  ```

  @selector input[up-switch]
  @param up-switch
    A CSS selector for elements whose visibility depends on this field's value.
  @stable
  */

  /*-
  Only shows this element if an input field with [`[up-switch]`](/input-up-switch) has one of the given values.

  See [`input[up-switch]`](/input-up-switch) for more documentation and examples.

  @selector [up-show-for]
  @param [up-show-for]
    A space-separated list of input values for which this element should be shown.
  @stable
  */

  /*-
  Hides this element if an input field with [`[up-switch]`](/input-up-switch) has one of the given values.

  See [`input[up-switch]`](/input-up-switch) for more documentation and examples.

  @selector [up-hide-for]
  @param [up-hide-for]
    A space-separated list of input values for which this element should be hidden.
  @stable
  */
  up.compiler('[up-switch]', (switcher) => {
    switchTargets(switcher)
  })

  up.on('change', '[up-switch]', (_event, switcher) => {
    switchTargets(switcher)
  })

  up.compiler('[up-show-for]:not(.up-switched), [up-hide-for]:not(.up-switched)', (element) => {
    switchTarget(element)
  })

  /*-
  Observes this field and runs a callback when a value changes.

  This is useful for observing text fields while the user is typing.
  If you want to submit the form after a change see [`input[up-autosubmit]`](/input-up-autosubmit).

  With a strict Content Security Policy [additional rules apply](/csp).

  The programmatic variant of this is the [`up.observe()`](/up.observe) function.

  ### Example

  The following would run a global `showSuggestions(value)` function
  whenever the `<input>` changes:

  ```html
  <input name="query" up-observe="showSuggestions(value)">
  ```
  
  Note that the parameter name in the markup must be called `value` or it will not work.
  The parameter name can be called whatever you want in the JavaScript, however.
      
  Also note that the function must be declared on the `window` object to work, like so:

  ```js
  window.showSuggestions = function(selectedValue) {
    console.log(`Called showSuggestions() with ${selectedValue}`)
  }
  ```

  ### Callback context

  The script given to `[up-observe]` runs with the following context:

  | Name     | Type      | Description                           |
  | -------- | --------- | ------------------------------------- |
  | `value`  | `string`  | The current value of the field        |
  | `this`   | `Element` | The form field                        |
  | `$field` | `jQuery`  | The form field as a jQuery collection |

  ### Observing radio buttons

  Multiple radio buttons with the same `[name]` (a radio button group)
  produce a single value for the form.

  To observe radio buttons group, use the `[up-observe]` attribute on an
  element that contains all radio button elements with a given name:

  ```html
  <div up-observe="formatSelected(value)">
    <input type="radio" name="format" value="html"> HTML format
    <input type="radio" name="format" value="pdf"> PDF format
    <input type="radio" name="format" value="txt"> Text format
  </div>
  ```

  @selector input[up-observe]
  @param up-observe
    The code to run when the field's value changes.
  @param up-delay
    The number of miliseconds to wait after a change before the code is run.

    You may use this option to limit how often the callback will run for a fast typist.

    If form is submitted during the delay, the callback will not run.
  @stable
  */

  /*-
  Observes this form and runs a callback when any field changes.

  This is useful for observing text fields while the user is typing.
  If you want to submit the form after a change see [`input[up-autosubmit]`](/input-up-autosubmit).

  With a strict Content Security Policy [additional rules apply](/csp).

  The programmatic variant of this is the [`up.observe()`](/up.observe) function.

  ### Example

  The would call a function `somethingChanged(value)`
  when any `<input>` within the `<form>` changes:

  ```html
  <form up-observe="somethingChanged(value)">
    <input name="foo">
    <input name="bar">
  </form>
  ```

  ### Callback context

  The script given to `[up-observe]` runs with the following context:

  | Name     | Type      | Description                           |
  | -------- | --------- | ------------------------------------- |
  | `value`  | `string`  | The current value of the field        |
  | `this`   | `Element` | The form field                        |
  | `$field` | `jQuery`  | The form field as a jQuery collection |

  @selector form[up-observe]
  @param up-observe
    The code to run when any field's value changes.
  @param up-delay
    The number of miliseconds to wait after a change before the code is run.
  @stable
  */
  up.compiler('[up-observe]', (formOrField) => observe(formOrField))

  /*-
  Submits this field's form when this field changes its values.

  Both the form and the changed field will be assigned a CSS class [`.up-active`](/form.up-active)
  while the autosubmitted form is loading.

  The programmatic variant of this is the [`up.autosubmit()`](/up.autosubmit) function.

  ### Example

  The following would automatically submit the form when the query is changed:

  ```html
  <form method="GET" action="/search">
    <input type="search" name="query" up-autosubmit>
    <input type="checkbox" name="archive"> Include archive
  </form>
  ```

  ### Auto-submitting radio buttons

  Multiple radio buttons with the same `[name]` (a radio button group)
  produce a single value for the form.

  To auto-submit radio buttons group, use the `[up-submit]` attribute on an
  element that contains all radio button elements with a given name:

  ```html
  <div up-autosubmit>
    <input type="radio" name="format" value="html"> HTML format
    <input type="radio" name="format" value="pdf"> PDF format
    <input type="radio" name="format" value="txt"> Text format
  </div>
  ```

  @selector input[up-autosubmit]
  @param [up-delay]
    The number of miliseconds to wait after a change before the form is submitted.
  @stable
  */

  /*-
  Submits the form when any field changes.

  Both the form and the field will be assigned a CSS class [`.up-active`](/form.up-active)
  while the autosubmitted form is loading.

  The programmatic variant of this is the [`up.autosubmit()`](/up.autosubmit) function.

  ### Example

  This will submit the form when either query or checkbox was changed:

  ```html
  <form method="GET" action="/search" up-autosubmit>
    <input type="search" name="query">
    <input type="checkbox" name="archive"> Include archive
  </form>
  ```

  @selector form[up-autosubmit]
  @param [up-delay]
    The number of miliseconds to wait after a change before the form is submitted.
  @stable
  */
  up.compiler('[up-autosubmit]', (formOrField) => autosubmit(formOrField))

  up.on('up:framework:reset', reset)

  return {
    config,
    submit,
    submitOptions,
    observeOptions,
    isSubmittable,
    observe,
    validate,
    autosubmit,
    fieldSelector,
    fields: findFields,
    focusedField,
    switchTarget,
    disable: disableContainer,
    disableAroundRequest,
    group: findGroup,
    groupSolution: findGroupSolution,
    get: getForm,
  }
})()

up.submit = up.form.submit
up.observe = up.form.observe
up.autosubmit = up.form.autosubmit
up.validate = up.form.validate
