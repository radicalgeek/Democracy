namespace Democracy.Services.Contracts.ViewModels
{
    public class PoliticalStanceViewModel
    {
        public int BillId { get; set; }
        public decimal VerticalAvarage { get; set; }
        public decimal HorizontalAvarage { get; set; }
        public string Title { get; set; }
        public bool AlreadySet { get; set; }
    }
}