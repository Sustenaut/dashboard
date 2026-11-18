Feature: The rest of the dashboard and how it is served
  Screens 4 to 6 of the design are layout only in phase 0, tagged Preview.
  Every page carries a strict content security policy and no script.

  Scenario Outline: A preview screen shows its layout, tagged Preview
    Given a person who has signed in
    When I GET "<page>"
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
    When I GET "/"
    Then the answer includes 'href="/wizard?org=Visit-ee"'
    And the page says "Unlock more"
    And the page does not say "P0"

  Scenario: Pages forbid scripts and framing
    When I GET "/"
    Then the answer's "content-security-policy" is "default-src 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    And the answer does not include "<script"

  Scenario: The health check answers without a session
    When I GET "/healthz"
    Then the answer is 200

  Scenario: The stylesheet is served
    When I GET "/assets/app.css"
    Then the answer is 200

  Scenario: Nothing outside the stylesheet's folder is served
    When I GET "/assets/..%2Fpackage.json"
    Then the answer is 404

  Scenario: A page that does not exist is not found
    Given a person who has signed in
    When I GET "/nowhere"
    Then the answer is 404

  Scenario: Only sign-out takes a POST
    Given a person who has signed in
    When I send "POST" to "/wizard"
    Then the answer is 405
