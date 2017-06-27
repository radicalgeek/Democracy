namespace Democracy.Data.DataModels
{
    public class OpinionDataModel
    {
        public int Id { get; set; }
        public int BillId { get; set; }
        public string House { get; set; }
        public string Stage { get; set; }
        public bool Vote { get; set; }
        public ConstituencyDataModel Constituency { get; set; }
    }
}