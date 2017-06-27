using System;

namespace Democracy.Data.DataModels
{
    public class OfficeDataModel
    {
        public int Id { get; set; }
        public string Department { get; set; }
        public string Position { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
    }
}