using System.ComponentModel.DataAnnotations.Schema;

namespace Democracy.Data.DataModels
{
    public class BillStanceDateModel 
    {
        public int id { get; set; }
        public string UserId { get; set; }
        public decimal HorizontalValue { get; set; }
        public decimal VerticalValue { get; set; }

        [Index]
        public int BillId { get; set; }
    }
}