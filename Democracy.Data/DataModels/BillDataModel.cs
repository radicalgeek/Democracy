using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Democracy.Data.DataModels
{
    public class BillDataModel
    {
        public int Id { get; set; }
        public string Stage { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string House { get; set; }
        public string BillType { get; set; }
        public DateTime UpdatedDate { get; set; }
        public string Url { get; set; }
        public double SocialScore { get; set; }
        public double EconomicScore { get; set; }
        public bool IsNew { get; set; }
        public bool IsUpdated { get; set; }
        public decimal VerticalValue { get; set; }
        public decimal HorizontalValue { get; set; }

        public virtual List<PeoplesDebatPostDataModel> DebatPosts { get; set; }
        public virtual List<VoteDateModel> Votes { get; set; }

        public virtual List<MpVoteRecord> MpVotes { get; set; }
    }
}
