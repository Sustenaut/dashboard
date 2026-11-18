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
    When I GET "/wizard"
    Then the page says "Orgs you own: Visit-ee."
    And the page does not say "other-org"

  Scenario: An org without the reader app offers to install it
    When I GET "/wizard?org=Visit-ee"
    Then the page says "Install Sustenaut reader on Visit-ee"
    When I GET "/wizard/install?org=Visit-ee"
    Then the answer is 303
    And they are sent to the app's install page for the org's id

  Scenario: GitHub's setup redirect brings them back to step 1 for the org
    Given the reader app is installed on "Visit-ee"
    When I GET "/setup?installation_id=42&setup_action=install"
    Then the answer is 303
    And the answer redirects to "/wizard?org=Visit-ee"

  Scenario: Each field is read both ways, and the diagnostics say which worked
    Given the reader app is installed on "Visit-ee"
    And way A reads the org as plan "free" with 2FA required
    And way A reads this month's summary as 1240 Actions minutes, 0 billed
    And way B is refused the org's billing with HTTP 403
    When I GET "/wizard?org=Visit-ee"
    Then the page says "What we read from Visit-ee"
    And the field "GitHub plan" was read by "A and B"
    And the field "Actions minutes this month, all repos" was read by "A only"
    And the field "Actions minutes billed this month" was read by "A only"
    And the field "Actions minutes included for private repos" was read by "from plan"
    And the field "Rulesets on private repos" was read by "from plan"
    And the page shows "Actions minutes this month, all repos" as "1,240"
    And the page shows "Actions minutes billed this month" as "0"
    And the page says "private repos get 2,000 minutes a month"
    And the page says "Not on this plan"
    And the diagnostics list "GET /organizations/{org}/settings/billing/usage/summary" for both ways
    And the diagnostics list "GET /orgs/{org}/rulesets" for both ways
    And GitHub was not asked about "/orgs/Visit-ee/settings/billing"
    And the installation token was used only for way A calls

  Scenario: Minutes on public repos count as used, not against the private allowance
    Given the reader app is installed on "Visit-ee"
    And way A reads the org as plan "team" with 2FA not required
    And way A reads this month's summary as 28858 Actions minutes, 0 billed, over three runners
    And way A reads this month's storage as 0.389 GB-hours, 0.001 billed
    When I GET "/wizard?org=Visit-ee"
    Then the page shows "Actions minutes this month, all repos" as "28,858"
    And the page shows "Actions minutes billed this month" as "0"
    And the page says "private repos get 3,000 minutes a month"
    And the page does not say "28,858 of"
    And the page does not say "GitHub is billing"
    And the page shows "Storage billed this month" as "0.001 GB-hours"
    And the page does not say "Not on this plan"

  Scenario: Billed minutes are said plainly
    Given the reader app is installed on "Visit-ee"
    And way A reads the org as plan "free" with 2FA required
    And way A reads this month's summary as 2500 Actions minutes, 500 billed
    When I GET "/wizard?org=Visit-ee"
    Then the page says "GitHub is billing 500 Actions minutes this month"

  Scenario: When neither way reads billing, the page says so
    Given the reader app is installed on "Visit-ee"
    When I GET "/wizard?org=Visit-ee"
    Then the page says "Actions minutes: not readable either way"
    And the field "Actions minutes this month, all repos" was read by "neither"

  Scenario: A name that is not an org's is refused without asking GitHub
    When I GET "/wizard?org=../app"
    Then the page says "That is not a GitHub organization name."
    And GitHub was not asked about "/orgs/../app"
