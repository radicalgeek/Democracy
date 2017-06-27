using Democracy.Data.DataModels;

namespace Democracy.Bills
{
    public interface IVoteService
    {
        void RegisterVoteForBill(bool vote, int billId, ConstituencyDataModel constituency);
        void RegisterUserParticipation(int billId, string userId);
        void RegisterOpinionForBill(bool vote, int billId, ConstituencyDataModel constituency);
    }
}