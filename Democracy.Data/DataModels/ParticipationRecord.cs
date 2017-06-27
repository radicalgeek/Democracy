using System.ComponentModel.DataAnnotations.Schema;

namespace Democracy.Data.DataModels
{
    public class ParticipationRecord
    {
        public int Id { get; set; }
        public string UserId { get; set; }
        [Index]
        public int BillId { get; set; }
        public string Stage { get; set; }
        public string House { get; set; }
    }
}