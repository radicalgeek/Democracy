using System;

namespace Democracy.Services.Contracts.ViewModels
{
    public class DebateViewModel
    {
        public int Id { get; set; }
        public string Body { get; set; }
        public MPViewModel Speaker { get; set; }
        public DateTime Date { get; set; }
        public int BillId { get; set; }
    }
}