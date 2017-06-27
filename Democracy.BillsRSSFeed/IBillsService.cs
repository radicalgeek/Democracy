using System.Collections.Generic;
using System.Threading.Tasks;
using Democracy.Bills.Models;
using Democracy.Services.Contracts.ViewModels;

namespace Democracy.Bills
{
    public interface IBillsService
    {
        List<BillViewModel> GetAllBills();
        BillViewModel GetBill(int id, string userId);
        
        ParliamentaryDebatesViewModel ParliamentaryDebatesForBill(int id);
        void SetBillStance(decimal vertical, decimal horizontal, int billId, string userId);
        PoliticalStanceViewModel GetPoliticalStance(int id, string userId);
        Task<StatisticsViewModel> GetStatistics();

        Task<List<ConstituencyViewModel>> GetConstituentyVoteDetails();
    }
}