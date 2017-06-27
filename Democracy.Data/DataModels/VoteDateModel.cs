using System.ComponentModel.DataAnnotations.Schema;

namespace Democracy.Data.DataModels
{
    public class VoteDateModel
    {
        public int Id { get; set; }
        [Index]
        public int BillDataModelId { get; set; }
        public virtual BillDataModel BillDataModel { get; set; }
        public string House { get; set; }
        public string Stage { get; set; }
        public bool Vote { get; set; }
        public virtual ConstituencyDataModel ConstituencyDataModel { get; set; }
        [Index]
        public int ConstituencyDataModelId { get; set; }
        public decimal VerticalValue { get; set; }

        public decimal HorizontalValue { get; set; }
    }
}