using System.Collections.Generic;
using Democracy.Bills.Models;
using Democracy.Services.Contracts.ViewModels;

namespace Democracy.Bills
{
    public interface IDebatesService
    {
        BillPeoplesDebateViewModel GetPeoplesDebatesByBill(int billId);
        void AddPeoplesComment(string user, string newComment, string billId);
    }
}