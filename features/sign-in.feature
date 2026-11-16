Feature: Signing in with GitHub
  The dashboard signs people in through the GitHub App's OAuth client. The
  user-to-server token it gets ("way B") is kept only in a sealed session
  cookie: there is no database.

  Scenario: A new visitor is asked to sign in
    When a visitor opens the dashboard
    Then the page says "Sign in to Sustenaut"
    And the page links to "/auth/login"
    And the page is tagged "Works in PoC"

  Scenario: Signing in with GitHub opens a session
    When a visitor starts signing in
    Then they are sent to GitHub's authorize page with the dashboard's client and callback
    When GitHub sends them back with a good code and the same state
    Then they are sent to "/"
    And they hold a session cookie that is HttpOnly, Secure and SameSite=Lax
    And the session cookie does not show the GitHub token
    When they open the dashboard
    Then the page says "Your organizations"
    And the page says "@david"

  Scenario: A callback with another state is refused
    When a visitor starts signing in
    And GitHub sends them back with a good code and another state
    Then they are sent to "/?error=state"
    And they hold no session cookie

  Scenario: A code GitHub will not swap is refused
    When a visitor starts signing in
    And GitHub sends them back with a bad code and the same state
    Then they are sent to "/?error=exchange"
    When they open the page "/?error=exchange"
    Then the page says "GitHub would not swap the sign-in code for a token"

  Scenario: A changed session cookie is not a session
    Given a person who has signed in
    When their session cookie is changed by one character
    And they open the dashboard
    Then the page says "Sign in to Sustenaut"

  Scenario: A session ends after eight hours
    Given a person who has signed in
    When nine hours pass
    And they open the page "/wizard"
    Then they are sent to "/"

  Scenario: Signing out ends the session
    Given a person who has signed in
    When they sign out
    Then they hold no session cookie
