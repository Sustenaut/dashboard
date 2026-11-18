Feature: Signing in with GitHub
  The dashboard signs people in through the GitHub App's OAuth client. The
  user-to-server token it gets ("way B") is kept only in a sealed session
  cookie: there is no database.

  Scenario: A new visitor is asked to sign in
    When I GET "/"
    Then the page says "Sign in to Sustenaut"
    And the answer includes 'href="/auth/login"'
    And the page is tagged "Works in PoC"

  Scenario: Signing in starts at GitHub's authorize page
    When I GET "/auth/login"
    Then they are sent to GitHub's authorize page with the dashboard's client and callback

  Scenario: GitHub sending them back with a good code opens a session
    Given a visitor who has started signing in
    When GitHub sends them back with a good code and the same state
    Then the answer is 303
    And the answer redirects to "/"
    And they hold a session cookie that is HttpOnly, Secure and SameSite=Lax
    And the session cookie does not show the GitHub token

  Scenario: A person who has signed in sees who they are
    Given a person who has signed in
    When I GET "/"
    Then the page says "Your organizations"
    And the page says "@david"

  Scenario: A callback with another state is refused
    Given a visitor who has started signing in
    When GitHub sends them back with a good code and another state
    Then the answer is 303
    And the answer redirects to "/?error=state"
    And they hold no session cookie

  Scenario: A code GitHub will not swap is refused
    Given a visitor who has started signing in
    When GitHub sends them back with a bad code and the same state
    Then the answer is 303
    And the answer redirects to "/?error=exchange"

  Scenario: The page a refused code comes back to says why
    When I GET "/?error=exchange"
    Then the page says "GitHub would not swap the sign-in code for a token"

  Scenario: A changed session cookie is not a session
    Given a person who has signed in
    When their session cookie is changed by one character
    And I GET "/"
    Then the page says "Sign in to Sustenaut"

  Scenario: A session ends after eight hours
    Given a person who has signed in
    When nine hours pass
    And I GET "/wizard"
    Then the answer is 303
    And the answer redirects to "/"

  Scenario: Signing out ends the session
    Given a person who has signed in
    When I send "POST" to "/auth/logout"
    Then they hold no session cookie
