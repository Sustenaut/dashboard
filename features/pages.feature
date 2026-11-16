Feature: The rest of the dashboard and how it is served
  Screens 4 to 6 of the design are layout only in phase 0, tagged Preview.
  Every page carries a strict content security policy and no script.

  Scenario Outline: A preview screen shows its layout, tagged Preview
    Given a person who has signed in
    When they open the page "<page>"
    Then the page says "<heading>"
    And the page is tagged "Preview"

    Examples:
      | page     | heading                     |
      | /project | Launch an app               |
      | /infra   | Linked SaaS accounts        |
      | /account | Unlock more                 |

  Scenario: The workspace lists the orgs the reader app is on
    Given a person who has signed in
    And the reader app is installed on "Visit-ee"
    When they open the dashboard
    Then the page links to "/wizard?org=Visit-ee"
    And the page says "Unlock more"
    And the page does not say "P0"

  Scenario: Pages forbid scripts and framing
    When a visitor opens the dashboard
    Then the answer's content security policy forbids scripts and framing
    And the page has no script

  Scenario: The health check answers without a session
    When a visitor opens the page "/healthz"
    Then the answer is HTTP 200

  Scenario: The stylesheet is served, and nothing outside its folder
    When a visitor opens the page "/assets/app.css"
    Then the answer is HTTP 200
    When a visitor opens the page "/assets/..%2Fpackage.json"
    Then the answer is HTTP 404

  Scenario: A page that does not exist is not found
    Given a person who has signed in
    When they open the page "/nowhere"
    Then the answer is HTTP 404

  Scenario: Only sign-out takes a POST
    Given a person who has signed in
    When they send a POST to "/wizard"
    Then the answer is HTTP 405
