using System.Collections.Generic;
using Democracy.Data.DataModels;

namespace Democracy.Services.Contracts.ViewModels
{
    public class MPViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public PartyDataModel Party { get; set; }
        public ConstituencyDataModel Constituency { get; set; }
        public List<OfficeDataModel> Offices { get; set; }
        public string ImageUrl { get; set; }
    }
}