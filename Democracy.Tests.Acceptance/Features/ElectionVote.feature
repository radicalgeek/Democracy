Feature: Election Vote 
	In order to vote in an elections
	As a verified voter
	I want to be presented with a lits of candidates for my local area

@mytag
Scenario: View candidates
	Given I have registerd as a verified voter
	And A general election vote is avaliable
	And there are 5 candidates in my area
	And I am on the topics page
	When I click general election
	Then I will be taken to the vote page
	And I will see 5 options
	And the options will be candidates from my local area

Scenario: Vote Labor
	Given I have registerd as a verified voter
	And A general election vote is avaliable
	And I am on the vote page
	When I click the labor candidate
	Then I will be taken to the vote confirmation page
	And I will see the time remaining untill the vote closes
	And I will have an option to go to my votes


