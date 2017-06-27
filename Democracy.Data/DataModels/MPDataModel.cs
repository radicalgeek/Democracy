using System.Collections.Generic;

namespace Democracy.Data.DataModels
{
    public class MPDataModel
    {
        public int Id { get; set; }
        public int TWFYMemberId { get; set; }
        public int TWFYPersonId { get; set; }
        public string Name { get; set; }

        public PartyDataModel Party { get; set; }

        public ConstituencyDataModel Constituency { get; set; }
        public List<OfficeDataModel> Offices { get; set; }
        public string ImageUrl { get; set; }

    }
}