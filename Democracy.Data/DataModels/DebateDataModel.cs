using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Democracy.Data.DataModels
{
    public class DebateDataModel
    {
        public int Id { get; set; }
        public string Body { get; set; }
        public MPDataModel Speaker { get; set; }
        public DateTime Date { get; set; }
        [Index] 
        public int BillId { get; set; }
    }
}