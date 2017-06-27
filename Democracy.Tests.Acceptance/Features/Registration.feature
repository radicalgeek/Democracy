Feature: RegistrationJourny
	In order to vote
	As an unregisterd user
	I want to register

@mytag
Scenario: user found on registrar
	Given I am on the landing page
	And I click start
	And I am taken to the registration page
	When I Fill in the registration form
	| field       | value    |
	| FirstName   | mark     |
	| LastName    | jones    |
	| PostCode    | NG17 1FQ |
	| HouseNumber | 96       |
	And I click continue
	Then My account will be created
	And I will be informed that I have been found on the voters registrar 
	And the vote button will be visible

Scenario: user not found on registrar
	Given I am on the landing page
	And I click start
	And I am taken to the registration page
	When I Fill in the registration form
	| field       | value    |
	| FirstName   | mark     |
	| LastName    | jones    |
	| PostCode    | NG17 1FQ |
	| HouseNumber | 96       |
	And I click continue
	Then My account will be created
	And I will be informed that I have not been found on the voters registrar 
	And I will be informed that my votes will only count towards opinion polls
	And the vote button will be visible

Scenario: user email address already registerd
	Given I am on the landing page
	And an account exists with the email address mark@radicalgeek.co.uk
	And I click start
	And I am taken to the registration page
	When I Fill in the registration form
	| field       | value    |
	| FirstName   | mark     |
	| LastName    | jones    |
	| PostCode    | NG17 1FQ |
	| HouseNumber | 96       |
	And I click continue
	Then I will be informed that the email address is already registerd
