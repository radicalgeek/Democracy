using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using Democracy.Data.DataModels;

namespace Democracy.Services.Contracts.ViewModels
{
    public class BillViewModel
    {
        [Key]
        public int Id { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }

        [DisplayName("Current Stage")]
        public string Stage { get; set; }

        [DisplayName("Current House")]
        public string House { get; set; }

        [DisplayName("Type")]
        public string BillType { get; set; }

        [DisplayName("Last Updated")]
        public DateTime UpdatedDate { get; set; }

        public string Url { get; set; }
        public double SocialScore { get; set; }
        public double EconomicScore { get; set; }
        public bool IsNew { get; set; }
        public bool IsUpdated { get; set; }

        public bool UserHasVoted { get; set; }
        public VoteStatisticsViewModel PreviouseLocalVotes { get; set; }
        public VoteStatisticsViewModel PreviouseNationalVotes { get; set; }
        public VoteStatisticsViewModel PreviouseParlimantaryVotes { get; set; }
        public PoliticalStanceViewModel PoliticalStance { get; set; }

        public BillViewModel MapBillDataModel(BillDataModel model)
        {
            Id = model.Id;
            Stage = model.Stage;
            Title = model.Title;
            Description = model.Description;
            House = model.House;
            BillType = model.BillType;
            UpdatedDate = model.UpdatedDate;
            Url = model.Url;
            SocialScore = model.SocialScore;
            EconomicScore = model.EconomicScore;
            IsNew = model.IsNew;
            IsUpdated = model.IsUpdated;
            return this;
        }
    }

    
}
