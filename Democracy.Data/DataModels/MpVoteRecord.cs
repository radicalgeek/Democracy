using System;

namespace Democracy.Data.DataModels
{
    public class MpVoteRecord
    {
        public int Id { get; set; }
        public DateTime Date { get; set; }
        public MPDataModel Mp { get; set; }
        public BillDataModel Bill { get; set; }
        public VoteType Vote { get; set; }
    }
}