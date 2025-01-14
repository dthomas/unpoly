u = up.util
$ = jQuery

beforeAll ->
  @hrefBeforeSuite = location.href
  @titleBeforeSuite = document.title

afterAll ->
  if up.history.config.enabled
    history.replaceState?({ fromResetPathHelper: true }, '', @hrefBeforeSuite)
    document.title = @titleBeforeSuite

beforeEach ->
  # Webkit ignores replaceState() calls after 100 calls / 30 sec.
  # So specs need to explicitly enable history handling.
  up.history.config.enabled = false

  # Store original URL and title so specs may use it
  @locationBeforeExample = location.href
  @titleBeforeExample = document.title

afterEach ->
  up.viewport.root.scrollTop = 0
