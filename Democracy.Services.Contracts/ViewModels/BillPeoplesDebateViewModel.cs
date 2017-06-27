using System.Collections.Generic;

namespace Democracy.Services.Contracts.ViewModels
{
    public class BillPeoplesDebateViewModel
    {
        public List<PeoplesDebatePostViewModel> Posts { get; set; }

        public int BillId { get; set; }
        public string Title { get; set; }

    }
}
