using System.Linq;
using Democracy.Data.DataModels;
using Democracy.Data.Interfaces;
using Democracy.Models;

namespace Democracy.Bills
{
    public class VoteService : IVoteService
    {
        private readonly IDatabaseRepository _db;

        public VoteService(IDatabaseRepository databaseRepository)
        {
            _db = databaseRepository;
        }
        public void RegisterVoteForBill(bool vote, int billId, ConstituencyDataModel constituency)
        {
            decimal verticalAvarage = 50;
            decimal horizontalAvarage = 50;
            var bill = _db.Single<BillDataModel>(b => b.Id == billId);
            var allStanceRecordsForBill = _db.All<BillStanceDateModel>().Where(s => s.BillId == billId);
            if (allStanceRecordsForBill.Any())
            {

                verticalAvarage = allStanceRecordsForBill.Sum(s => s.VerticalValue) / allStanceRecordsForBill.Count();
                horizontalAvarage = allStanceRecordsForBill.Sum(s => s.HorizontalValue) / allStanceRecordsForBill.Count();
            }

            var newVote = new VoteDateModel()
            {
                BillDataModelId = bill.Id,
                House = bill.House,
                Stage = bill.Stage,
                Vote = vote,
                ConstituencyDataModelId = constituency.Id,
                VerticalValue = verticalAvarage,
                HorizontalValue = horizontalAvarage
            };

            _db.Add<VoteDateModel>(newVote);
            _db.CommitChanges();
        }

        public void RegisterUserParticipation(int billId, string userId)
        {
            var bill = _db.Single<BillDataModel>(b => b.Id == billId);
            var user = _db.Single<ApplicationUser>(u => u.Id == userId);

            var participationRecord = new ParticipationRecord()
            {
                UserId = user.Id,
                BillId = bill.Id,
                Stage = bill.Stage,
                House = bill.House
            };
            _db.Add<ParticipationRecord>(participationRecord);
            _db.CommitChanges();
        }

        public void RegisterOpinionForBill(bool vote, int billId, ConstituencyDataModel constituency)
        {
            var bill = _db.Single<BillDataModel>(b => b.Id == billId);

            var newOpinion = new OpinionDataModel()
            {
                BillId = bill.Id,
                House = bill.House,
                Stage = bill.Stage,
                Vote = vote,
                Constituency = constituency
            };
            _db.Add<OpinionDataModel>(newOpinion);
            _db.CommitChanges();
        }
    }
}