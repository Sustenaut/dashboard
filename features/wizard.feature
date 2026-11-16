Feature: Step 1 of the wizard: link an org and read what the reader app may see
  The person picks an org they own and installs "Sustenaut reader (test)" on
  it. The dashboard then reads the org's plan, Actions minutes, storage, 2FA
  requirement and ruleset support two ways: A with the app's installation
  token, B with the person's own sign-in token, and shows which way read
  each field, from which endpoint, with which HTTP status.

  Background:
    Given a person who has signed in
    And they own the org "Visit-ee" and are a member of "other-org"

  Scenario: Step 1 offers only the orgs the person owns
    When they open the page "/wizard"
    Then the page says "Orgs you own: Visit-ee."
    And the page does not say "other-org"

  Scenario: An org without the reader app offers to install it
    When they open the page "/wizard?org=Visit-ee"
    Then the page says "Install Sustenaut reader on Visit-ee"
    When they open the page "/wizard/install?org=Visit-ee"
    Then they are sent to the app's install page for the org's id

  Scenario: GitHub's setup redirect brings them back to step 1 for the org
    Given the reader app is installed on "Visit-ee"
    When they open the page "/setup?installation_id=42&setup_action=install"
    Then they are sent to "/wizard?org=Visit-ee"

  Scenario: Each field is read both ways, and the diagnostics say which worked
    Given the reader app is installed on "Visit-ee"
    And way A reads the org as plan "free" with 2FA required
    And way A reads the legacy Actions billing as 1240 of 2000 minutes
    And way A reads the legacy storage billing as 0.2 GB
    And way B is refused the org's billing with HTTP 403
    When they open the page "/wizard?org=Visit-ee"
    Then the page says "What we read from Visit-ee"
    And the field "GitHub plan" was read by "A and B"
    And the field "Actions minutes used this month" was read by "A only"
    And the field "Packages and Actions storage used (GB)" was read by "A only"
    And the field "Actions minutes included" was read by "A only"
    And the field "Rulesets on private repos" was read by "from plan"
    And the page shows Actions minutes as "1,240 of 2,000"
    And the page says "Not on this plan"
    And the diagnostics list "GET /organizations/{org}/settings/billing/usage" for both ways
    And the diagnostics list "GET /orgs/{org}/rulesets" for both ways
    And the installation token was used only for way A calls

  Scenario: With only enhanced billing, minutes come from usage items and the limit from the plan
    Given the reader app is installed on "Visit-ee"
    And way A reads the org as plan "team" with 2FA not required
    And way A's legacy billing endpoints answer HTTP 410
    And way A reads 90 Actions minutes and 720 GB-hours of storage in this month's usage
    When they open the page "/wizard?org=Visit-ee"
    Then the page shows Actions minutes as "90 of 3,000"
    And the field "Actions minutes used this month" was read by "A only"
    And the field "Actions minutes included" was read by "from plan"
    And the page says "GitHub's published included minutes for plan team"
    And the page does not say "Not on this plan"

  Scenario: When neither way reads billing, the page says so
    Given the reader app is installed on "Visit-ee"
    When they open the page "/wizard?org=Visit-ee"
    Then the page says "Actions minutes: not readable either way"
    And the field "Actions minutes used this month" was read by "neither"

  Scenario: A name that is not an org's is refused without asking GitHub
    When they open the page "/wizard?org=../app"
    Then the page says "That is not a GitHub organization name."
    And GitHub was not asked about "/orgs/../app"
