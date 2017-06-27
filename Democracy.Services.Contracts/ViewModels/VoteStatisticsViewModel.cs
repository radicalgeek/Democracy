using Democracy.Data.DataModels;

namespace Democracy.Services.Contracts.ViewModels
{
    public class VoteStatisticsViewModel
    {
        public decimal ForCount { get; set; }
        public decimal ForPercent { get; set; }
        public decimal AgainstCount { get; set; }
        public decimal AgainstPercent { get; set; }
        public decimal Turnout { get; set; }
        public decimal AbstainCount { get; set; }
        public decimal AbstainPercentage { get; set; }
        public decimal RegisterdVoters { get; set; }
        public decimal SignedUpVoters { get; set; }
        public decimal SignedUpPercentage { get; set; }
        public decimal percentageRepresented { get; set; }
        public string mpVoted { get; set; }
    }
}