using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web;
using System.Web.Helpers;
using Democracy.Bills.Extentions;
using Democracy.Bills.Models;
using Democracy.Data.DataModels;
using Democracy.Data.Interfaces;
using Democracy.Models;
using Democracy.PublicWhip;
using Democracy.Services.Contracts.ViewModels;
using Democracy.TheyWorkForYou;
using Newtonsoft.Json;


namespace Democracy.Bills
{
    public class BillsService : IBillsService
    {
        private readonly IDatabaseRepository _db;
        private readonly IRssClient _rssClient;
       
        public BillsService(IDatabaseRepository databaseRepository, IRssClient rssClient)
        {
            _db = databaseRepository;
            _rssClient = rssClient;
        }

        public List<BillViewModel> GetAllBills()
        {
            var bills = new List<BillViewModel>();
            var billsData = _db.All<BillDataModel>().ToList();

            if (!billsData.Any())
            {
                //UpdateBillData();
                var voteDataProvider = new VoteData(_db);
                voteDataProvider.PopulateVoteData();
                billsData = _db.All<BillDataModel>().ToList();
            }
            foreach (var billDataModel in billsData)
            {
                var bill = new BillViewModel();
                bill.MapBillDataModel(billDataModel);
                bills.Add(bill);
            }
            return bills;
        }

        public BillViewModel GetBill(int id, string userId)
        {
            var bill = new BillViewModel().MapBillDataModel(_db.Single<BillDataModel>(b => b.Id == id));
            var user = _db.SingleIncluding<ApplicationUser>(u => u.Id == userId, u => u.ConstituencyDataModel);
            var participationRecords =
                _db.All<ParticipationRecord>()
                    .Where(
                        r =>
                            r.BillId == bill.Id && 
                            r.House == bill.House && 
                            r.Stage == bill.Stage && 
                            r.UserId == user.Id
                            ).ToList();

            bill.UserHasVoted = participationRecords.Any();
            bill.PreviouseLocalVotes = GetPreviouseLocalVotesForBill(id, user);
            bill.PreviouseNationalVotes = GetPreviouseNationalVotesForBill(id);
            bill.PreviouseParlimantaryVotes = GetPreviouseParlimantaryVotesForBill(id);
            bill.PoliticalStance = GetPoliticalStance(id, user.Id);
            return bill;
        }

        private VoteStatisticsViewModel GetPreviouseParlimantaryVotesForBill(int id)
        {


            var bill = _db.Single<BillDataModel>(b => b.Id == id);
            var votes = _db.AllIncluding<MpVoteRecord>(v => v.Bill).Where(v => v.Bill.Id == bill.Id).ToList();
            var publicVotes = _db.All<VoteDateModel>().Where(v =>  v.BillDataModelId == bill.Id);
            decimal totalpublicVoters = _db.All<ConstituencyDataModel>().Sum(c => c.RegisterdVoters);

            decimal publicForCount = 0;
            decimal publicAgainstCount = 0;
            decimal totalVotes = 0;
            decimal forVotes = 0;
            decimal againstVotes = 0;
            decimal abstainCount = 0;
            decimal forPercent = 0;
            decimal againstPercentage = 0;
            decimal abstainPercentage = 0;
            decimal publicForPercentage = 0;
            decimal publicAgainstPercentage = 0;


            if (votes.Count() > 0)
            {
                publicForCount = publicVotes.Count(v => v.Vote);
                publicAgainstCount = publicVotes.Count(v => v.Vote == false);
                totalVotes = votes.Count();
                forVotes = votes.Count(v => v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye);
                againstVotes = votes.Count(v => v.Vote == VoteType.No || v.Vote == VoteType.TellNo);
                abstainCount = votes.Count(v => v.Vote == VoteType.Missing);
                forPercent = forVotes/totalVotes*100;
                againstPercentage = againstVotes/totalVotes*100;
                abstainPercentage = againstVotes/totalVotes*100;
                publicForPercentage = (publicForCount / totalpublicVoters) * 100;
                publicAgainstPercentage = (publicAgainstCount / totalpublicVoters) * 100;
            }

            decimal percentageRepresented = 0;

            if (forVotes > againstVotes)
            {
                percentageRepresented = publicForPercentage;
            }
            else
            {
                percentageRepresented = publicAgainstPercentage;
            }


            var voteStatisticsViewModel = new VoteStatisticsViewModel()
            {
                ForCount = forVotes,
                ForPercent = forPercent,
                AgainstCount = againstVotes,
                AgainstPercent = againstPercentage,
                Turnout = totalVotes,
                AbstainCount = abstainCount,
                AbstainPercentage = abstainPercentage,
                percentageRepresented = percentageRepresented
            };
            return voteStatisticsViewModel;

        }

        private VoteStatisticsViewModel GetPreviouseNationalVotesForBill(int billId)
        {
            var votes = _db.All<VoteDateModel>().Where(v =>  v.BillDataModelId == billId).ToList();
            decimal signedupVotersCount = _db.All<ApplicationUser>().Where(u => u.IsIdentityVerified == true).Count();
            decimal totalVoters = _db.All<ConstituencyDataModel>().Sum(c => c.RegisterdVoters);


            decimal numberOfVotes = 0;
            decimal turnOut = 0;
            decimal forCount = 0;
            decimal forPercent = 0;
            decimal againstCount = 0;
            decimal againstPercentage = 0;
            decimal abstainCount = 0;
            decimal abstainPercentage = 0.00M;
            decimal votersOnSitePercentage = 0.00M;


            if (votes.Count() > 0 && signedupVotersCount > 0)
            {
                numberOfVotes = votes.Count();
                turnOut = (numberOfVotes / totalVoters) * 100;
                forCount = votes.Where(v => v.Vote == true).Count();
                forPercent = (forCount / totalVoters) * 100;
                againstCount = votes.Where(v => v.Vote == false).Count();
                againstPercentage = (againstCount / totalVoters) * 100;
                abstainCount = totalVoters - numberOfVotes;
                abstainPercentage = abstainCount / totalVoters * 100;
                votersOnSitePercentage = signedupVotersCount/totalVoters*100;
            }



            var voteStatisticsViewModel = new VoteStatisticsViewModel()
            {
                ForCount = forCount,
                ForPercent = forPercent,
                AgainstCount = againstCount,
                AgainstPercent = againstPercentage,
                Turnout = turnOut,
                AbstainCount = abstainCount,
                AbstainPercentage = abstainPercentage,
                RegisterdVoters = totalVoters,
                SignedUpVoters = signedupVotersCount,
                SignedUpPercentage = votersOnSitePercentage
            };
            return voteStatisticsViewModel;
        }

        private VoteStatisticsViewModel GetPreviouseLocalVotesForBill(int billId, ApplicationUser user)
        {
            var allLocalVotes = _db.AllIncluding<VoteDateModel>(v => v.ConstituencyDataModel).Where(v => v.ConstituencyDataModelId == user.ConstituencyDataModel.Id && v.BillDataModelId == billId);
            decimal totalConstituencyApplicationVotersCount = _db.AllIncluding<ApplicationUser>(u => u.ConstituencyDataModel).Count(u => u.ConstituencyDataModel.Id == user.ConstituencyDataModel.Id && u.IsIdentityVerified == true);
            decimal totalConstituencyRegisterdVotersCount = user.ConstituencyDataModel.RegisterdVoters;

            var mp = _db.SingleIncluding<MPDataModel>(m => m.Constituency.Id == user.ConstituencyDataModel.Id, m => m.Constituency);
            var mpVote = _db.SingleIncluding<MpVoteRecord>(v => v.Mp.Id == mp.Id && v.Bill.Id == billId, v => v.Mp,v => v.Bill);
            decimal representativePercentage = 0M;
            var vote = "";
            

            decimal turnOut = 0.00M;
            decimal forCount = 0;
            decimal forPercent = 0.00M;
            decimal againstCount = 0;
            decimal againstPercentage = 0.00M;
            decimal abstainCount = 0;
            decimal abstainPercentage = 0.00M;
            decimal votersOnSitePercentage = 0.00M;



            if (allLocalVotes.Count() > 0 && totalConstituencyApplicationVotersCount > 0)
            {
                decimal numberOfVotes = allLocalVotes.Count();
                turnOut = numberOfVotes / totalConstituencyRegisterdVotersCount * 100;
                forCount = allLocalVotes.Where(v => v.Vote == true).Count();
                forPercent = forCount / totalConstituencyRegisterdVotersCount * 100;
                againstCount = allLocalVotes.Where(v => v.Vote == false).Count();
                againstPercentage = againstCount / totalConstituencyRegisterdVotersCount * 100;
                abstainCount = totalConstituencyRegisterdVotersCount - numberOfVotes;
                abstainPercentage = abstainCount / totalConstituencyRegisterdVotersCount *100;
                votersOnSitePercentage = totalConstituencyApplicationVotersCount/totalConstituencyRegisterdVotersCount*100;
            }
            if (mpVote != null)
            {   
                switch (mpVote.Vote)
                {
                    case VoteType.Aye:
                    case VoteType.TellAye:
                        representativePercentage = forPercent;
                        vote = "voted for";
                        break;
                    case VoteType.No:
                    case VoteType.TellNo:
                        representativePercentage = againstPercentage;
                        vote = "voted against";
                        break; 
                    case VoteType.Missing:
                        representativePercentage = 0;
                        vote = "did not vote on";
                        break;
                }
                
            }
            else
            {
                representativePercentage = 0;
                vote = "did not vote on";
            }


            var voteStatisticsViewModel = new VoteStatisticsViewModel()
            {
                ForCount = forCount,
                ForPercent = forPercent,
                AgainstCount = againstCount,
                AgainstPercent = againstPercentage,
                Turnout = turnOut,
                AbstainCount = abstainCount,
                AbstainPercentage = abstainPercentage,
                RegisterdVoters = totalConstituencyRegisterdVotersCount,
                SignedUpVoters = totalConstituencyApplicationVotersCount,
                SignedUpPercentage = votersOnSitePercentage,
                percentageRepresented = representativePercentage,
                mpVoted = vote
            };
            return voteStatisticsViewModel;
        }

        public ParliamentaryDebatesViewModel ParliamentaryDebatesForBill(int id)
        {
            //var debates = _db.All<DebateDataModel>().Where(d => d.BillId == id).IncludeMultiple(b => b.Speaker).ToList();
            var debates = _db.AllIncluding<DebateDataModel>(b => b.Speaker, b => b.Speaker.Constituency).Where(d => d.BillId == id);
            var bill = _db.Single<BillDataModel>(b => b.Id == id);
            var model = new ParliamentaryDebatesViewModel();
            model.dabates = debates.ToList();
            model.Title = bill.Title;
            model.Stage = bill.Stage;
            model.House = bill.House;
            return model;
        }

        public void SetBillStance(decimal vertical, decimal horizontal, int billId, string userId)
        {
            RegisterStanceVoteForBill(billId, vertical, horizontal, userId);
        }

        public PoliticalStanceViewModel GetPoliticalStance(int id, string userId)
        {
            var stance = new PoliticalStanceViewModel();
            decimal verticalAvarage = 50;
            decimal horizontalAvarage = 50;

            var bill = _db.Single<BillDataModel>(b => b.Id == id);
            stance.BillId = id;
            stance.Title = bill.Title;
            var allStanceRecordsForBill = _db.All<BillStanceDateModel>().Where(s => s.BillId == id);
            if (allStanceRecordsForBill.Any())
            {
                
                verticalAvarage = allStanceRecordsForBill.Sum(s => s.VerticalValue) / allStanceRecordsForBill.Count();
                horizontalAvarage = allStanceRecordsForBill.Sum(s => s.HorizontalValue) / allStanceRecordsForBill.Count();
            }

            var range = 360;
            var horizontalLowerBound = -141;
            var verticalLowerBound = -276;

            var targetHorizontalGraphValue = (horizontalAvarage / 100) * range - Math.Abs(horizontalLowerBound);
            var targetVerticalGraphValue = ((100 - verticalAvarage) / 100) * range - Math.Abs(verticalLowerBound);

            stance.HorizontalAvarage = targetHorizontalGraphValue;
            stance.VerticalAvarage = targetVerticalGraphValue;

            var hasUserSetStance = allStanceRecordsForBill.Any(s => s.UserId == userId);
            if (hasUserSetStance)
            {
                stance.AlreadySet = true;
            }
            else
            {
                stance.AlreadySet = false;
            }
            return stance;
        }

        public async Task<StatisticsViewModel> GetStatistics()
        {
            
            var votesByContituency = await GetConstituentyVoteDetails();
            var votes = await _db.AllAsync<VoteDateModel>();
            var mpVotes = await _db.AllIncludingAsync<MpVoteRecord>(v => v.Bill);

            //await Task.WhenAll(votesByContituency, votes, mpVotes);

            var nationalAuthoriterianLeftVotesFor =
                votes.Where(v => v.HorizontalValue < 50 && v.VerticalValue > 50 && v.Vote == true).Count();
            var nationalAuthoriterianRightVotesFor =
                votes.Where(v => v.HorizontalValue > 50 && v.VerticalValue > 50 && v.Vote == true).Count();
            var nationalLibeterianLeftVotesFor =
                votes.Where(v => v.HorizontalValue < 50 && v.VerticalValue < 50 && v.Vote == true).Count();
            var nationalLibeterianRightVotesFor =
                votes.Where(v => v.HorizontalValue > 50 && v.VerticalValue < 50 && v.Vote == true).Count();

            var nationalAuthoriterianLeftVotesAgainst =
                votes.Where(v => v.HorizontalValue < 50 && v.VerticalValue > 50 && v.Vote == false).Count();
            var nationalAuthoriterianRightVotesAgainst =
                votes.Where(v => v.HorizontalValue > 50 && v.VerticalValue > 50 && v.Vote == false).Count();
            var nationalLibeterianLeftVotesAgainst =
                votes.Where(v => v.HorizontalValue < 50 && v.VerticalValue < 50 && v.Vote == false).Count();
            var nationalLibeterianRightVotesAgainst =
                votes.Where(v => v.HorizontalValue > 50 && v.VerticalValue < 50 && v.Vote == false).Count();

            decimal totalHorizontalAvarage = 0;
            decimal totalVerticalAvarage = 0;
            
            try
            {
                totalHorizontalAvarage =
                votes.Where(v => v.Vote == true).Sum(v => v.HorizontalValue) / votes.Count();
            }
            catch (DivideByZeroException ex)
            {
                totalHorizontalAvarage = 50;
            }

            try
            {
                totalVerticalAvarage =
                votes.Where(v => v.Vote == true).Sum(v => v.VerticalValue) / votes.Count();
            }
            catch (DivideByZeroException ex)
            {

                totalVerticalAvarage = 50;
            }
            
            

            var range = 360;
            var horizontalLowerBound = -141;
            var verticalLowerBound = -276;

            var targetHorizontalGraphValue = (totalHorizontalAvarage / 100) * range - Math.Abs(horizontalLowerBound);
            var targetVerticalGraphValue = ((100 - totalVerticalAvarage) / 100) * range - Math.Abs(verticalLowerBound);
            

            var mpAuthoriterianLeftVotesFor =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue < 50 && v.Bill.VerticalValue > 50 &&
                        (v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye)).Count();
            var mpAuthoriterianRightVotesFor =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue > 50 && v.Bill.VerticalValue > 50 &&
                        (v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye)).Count();
            var mpLibeterianLeftVotesFor =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue < 50 && v.Bill.VerticalValue < 50 &&
                        (v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye)).Count();
            var mpLibeterianRightVotesFor =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue > 50 && v.Bill.VerticalValue < 50 &&
                        (v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye)).Count();
            
            var mpAuthoriterianLeftVotesAgainst =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue < 50 && v.Bill.VerticalValue > 50 &&
                        (v.Vote == VoteType.No || v.Vote == VoteType.TellNo)).Count();
            var mpAuthoriterianRightVotesAgainst =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue > 50 && v.Bill.VerticalValue > 50 &&
                        (v.Vote == VoteType.No || v.Vote == VoteType.TellNo)).Count();
            var mpLibeterianLeftVotesAgainst =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue < 50 && v.Bill.VerticalValue < 50 &&
                        (v.Vote == VoteType.No || v.Vote == VoteType.TellNo)).Count();
            var mpLibeterianRightVotesAgainst =
                mpVotes.Where(
                    v =>
                        v.Bill.HorizontalValue > 50 && v.Bill.VerticalValue < 50 &&
                        (v.Vote == VoteType.No || v.Vote == VoteType.TellNo)).Count();


            
            var winningVotes = new List<MpVoteRecord>();
            var bills = await _db.AllAsync<BillDataModel>();
            var billsWithWinningVotes = new List<BillDataModel>();
            var wonBillsCount = 0;

            foreach (var billDataModel in bills)
            {
                var forVotes = billDataModel.MpVotes.Count(v => v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye);
                var againstVotes = billDataModel.MpVotes.Count(v => v.Vote == VoteType.No || v.Vote == VoteType.TellNo);
                if (forVotes > againstVotes)
                {
                    //winningVotes.AddRange(billDataModel.MpVotes);
                    //wonBillsCount += 1;
                    billsWithWinningVotes.Add(billDataModel);
                }
                    

            }

            decimal totalMpHorizontalAvarage = 0;
            decimal totalMpVerticalAvarage = 0;


            try
            {
                totalMpHorizontalAvarage =
                billsWithWinningVotes.Sum(b => b.HorizontalValue) / billsWithWinningVotes.Count(b => b.HorizontalValue != 0);
            }
            catch (DivideByZeroException)
            {
                totalMpHorizontalAvarage = 50;
            }

            try
            {
               totalMpVerticalAvarage =
               billsWithWinningVotes.Sum(b => b.VerticalValue) / billsWithWinningVotes.Count(b => b.VerticalValue != 0);

            }
            catch (DivideByZeroException)
            {
                totalMpVerticalAvarage = 50;
            }
            
            

            var targetMPHorizontalGraphValue = (totalMpHorizontalAvarage / 100) * range - Math.Abs(horizontalLowerBound);
            var targetMPVerticalGraphValue = ((100 - totalMpVerticalAvarage) / 100) * range - Math.Abs(verticalLowerBound);


            var trendingBills = bills.Where(b => b.DebatPosts.Any(p => p.Date > DateTime.Now.AddDays(-2))).OrderByDescending(b => b.DebatPosts.Count).Take(5);


           // var mpVoteStatistics = new List<VoteStatisticsViewModel>();
            var representativeVotes = new List<bool>();


            var votesOnThisBillFor = votes.Where(v => v.Vote == true).Count();
            var votesOnThisBillAgainst = votes.Where(v => v.Vote == false).Count();

            var mpVotesOnThisBillFor = mpVotes.Where(v => v.Vote == VoteType.Aye || v.Vote == VoteType.TellAye).Count();
            var mpVotesOnThisBillAgainst = mpVotes.Where(v => v.Vote == VoteType.No || v.Vote == VoteType.TellNo).Count();

                var isVotedForByPeople = votesOnThisBillFor > votesOnThisBillAgainst;

                var isVotedForByMps = mpVotesOnThisBillFor > mpVotesOnThisBillAgainst;
                representativeVotes.Add(isVotedForByMps == isVotedForByPeople);

               // mpVoteStatistics.Add(GetPreviouseParlimantaryVotesForBill(billDataModel.Id));

            var overAllMpRepresentationPercentage = 0;
            var overAllMpParticipationPercentage = 0;
                try
                {
                    overAllMpRepresentationPercentage = (representativeVotes.Where(v => v == true).Count() / representativeVotes.Count()) * 100;
                }
                catch (DivideByZeroException)
                {
                    overAllMpRepresentationPercentage = 50;
                }

                try
                {
                    overAllMpParticipationPercentage = (mpVotes.Where(v => v.Vote == VoteType.Missing).Count() /
                                                    mpVotes.Count()) * 100;
                }
                catch (DivideByZeroException)
                {
                    overAllMpParticipationPercentage = 50;
                }

            
            decimal overAllSiteRepresentative;
            decimal totalVoters = votesByContituency.Sum(c => c.Voters);
            decimal totalVerifiedVoters = votesByContituency.Sum(c => c.RegisterdSiteUsers);
            var totalUnVerifiedVoters = votesByContituency.Sum(c => c.UnRegisterdSiteUsers);
            try
            {
                overAllSiteRepresentative = (totalVerifiedVoters/totalVoters)*100;
            }
            catch (DivideByZeroException)
            {
                overAllSiteRepresentative = 0;
            }

            



            var statisticsViewModel = new StatisticsViewModel()
            {
                VotesByContituency =Json.Encode(votesByContituency),
                NationalAuthoriterianLeftVotesFor = nationalAuthoriterianLeftVotesFor,
                NationalAuthoriterianRightVotesFor = nationalAuthoriterianRightVotesFor,
                NationalLibeterianLeftVotesFor = nationalLibeterianLeftVotesFor,
                NationalLibeterianRightVotesFor = nationalLibeterianRightVotesFor,
                NationalAuthoriterianLeftVotesAgainst = nationalAuthoriterianLeftVotesAgainst,
                NationalAuthoriterianRightVotesAgainst = nationalAuthoriterianRightVotesAgainst,
                NationalLibeterianLeftVotesAgainst = nationalLibeterianLeftVotesAgainst,
                NationalLibeterianRightVotesAgainst = nationalLibeterianRightVotesAgainst,
                TotalHorizontalAvarage = targetHorizontalGraphValue,
                TotalVerticalAvarage = targetVerticalGraphValue,
                MpAuthoriterianLeftVotesFor = mpAuthoriterianLeftVotesFor,
                MpAuthoriterianRightVotesFor = mpAuthoriterianRightVotesFor,
                MpLibeterianLeftVotesFor = mpLibeterianLeftVotesFor,
                MpLibeterianRightVotesFor = mpLibeterianRightVotesFor,
                MpAuthoriterianLeftVotesAgainst = mpAuthoriterianLeftVotesAgainst,
                MpAuthoriterianRightVotesAgainst = mpAuthoriterianRightVotesAgainst,
                MpLibeterianLeftVotesAgainst = mpLibeterianLeftVotesAgainst,
                MpLibeterianRightVotesAgainst = mpLibeterianRightVotesAgainst,
                TotalMpHorizontalAvarage = targetMPHorizontalGraphValue,
                TotalMpVerticalAvarage = targetMPVerticalGraphValue,
                OverAllRepresentationPercentage = overAllMpRepresentationPercentage,
                OverAllMpParticipationPercentage = overAllMpParticipationPercentage,
                OverAllSiteRepresentative = overAllSiteRepresentative,
                TotalVoters = totalVoters,
                TotalVerifiedVoters = totalVerifiedVoters,
                TotalUnVerifiedVoters = totalUnVerifiedVoters,
                TrendingBills = trendingBills.ToList()
            };

            return statisticsViewModel;

        }

        public async Task<List<ConstituencyViewModel>> GetConstituentyVoteDetails()
        {
            var constituencyViewModels = new List<ConstituencyViewModel>();
            var constituencies = await _db.AllAsync<ConstituencyDataModel>();
            foreach (var constituencyDataModel in constituencies)
            {
                var constituencyViewModel = new ConstituencyViewModel
                {
                    Name = constituencyDataModel.Name,
                    Voters = constituencyDataModel.RegisterdVoters
                };

                var siteUsers = await _db.AllAsync<ApplicationUser>();
                var voters = await _db.AllAsync<VoteDateModel>();

                //await Task.WhenAll(siteUsers, voters);

                constituencyViewModel.RegisterdSiteUsers = siteUsers.Count(u => u.ConstituencyDataModelId == constituencyDataModel.Id && u.IsIdentityVerified == true);
                constituencyViewModel.UnRegisterdSiteUsers = siteUsers.Count(u => u.ConstituencyDataModelId == constituencyDataModel.Id && u.IsIdentityVerified == false);

                var constituencyVotes =
                    voters.Where(v => v.ConstituencyDataModelId == constituencyDataModel.Id);

                constituencyViewModel.AuthoriterianLeftVotesFor =
                constituencyVotes.Count(v => v.HorizontalValue < 50 && v.VerticalValue > 50 && v.Vote);
                constituencyViewModel.AuthoriterianRightVotesFor =
                    constituencyVotes.Count(v => v.HorizontalValue > 50 && v.VerticalValue > 50 && v.Vote);
                constituencyViewModel.LibeterianLeftVotesFor =
                    constituencyVotes.Count(v => v.HorizontalValue < 50 && v.VerticalValue < 50 && v.Vote);
                constituencyViewModel.LibeterianRightVotesFor =
                    constituencyVotes.Count(v => v.HorizontalValue > 50 && v.VerticalValue < 50 && v.Vote);

                constituencyViewModels.Add(constituencyViewModel);
            }
            return constituencyViewModels;
        }

        public void RegisterStanceVoteForBill(int billId, decimal vertical, decimal horizontal, string userId)
        {
            var bill = _db.Single<BillDataModel>(b => b.Id == billId);

            var voteStance = new BillStanceDateModel()
            {
                BillId = bill.Id,
                VerticalValue = vertical,
                HorizontalValue = horizontal,
                UserId = userId
            };
            bill.VerticalValue = vertical;
            bill.HorizontalValue = horizontal;
            _db.Update<BillDataModel>(bill);
            _db.Add<BillStanceDateModel>(voteStance);
            _db.CommitChanges();
        }
    }

    public class ConstituencyViewModel
    {
        public int AuthoriterianLeftVotesFor { get; set; }
        public string Name { get; set; }
        public int Voters { get; set; }
        public int AuthoriterianRightVotesFor { get; set; }
        public int LibeterianLeftVotesFor { get; set; }
        public int LibeterianRightVotesFor { get; set; }
        public int RegisterdSiteUsers { get; set; }
        public int UnRegisterdSiteUsers { get; set; }
    }

    public class StatisticsViewModel
    {
        public string VotesByContituency { get; set; }
        public int NationalAuthoriterianLeftVotesFor { get; set; }
        public int NationalAuthoriterianRightVotesFor { get; set; }
        public int NationalLibeterianLeftVotesFor { get; set; }
        public int NationalLibeterianRightVotesFor { get; set; }
        public int NationalAuthoriterianLeftVotesAgainst { get; set; }
        public int NationalAuthoriterianRightVotesAgainst { get; set; }
        public int NationalLibeterianLeftVotesAgainst { get; set; }
        public int NationalLibeterianRightVotesAgainst { get; set; }
        public decimal TotalHorizontalAvarage { get; set; }
        public decimal TotalVerticalAvarage { get; set; }
        public int MpAuthoriterianLeftVotesFor { get; set; }
        public int MpAuthoriterianRightVotesFor { get; set; }
        public int MpLibeterianLeftVotesFor { get; set; }
        public int MpLibeterianRightVotesFor { get; set; }
        public int MpAuthoriterianLeftVotesAgainst { get; set; }
        public int MpAuthoriterianRightVotesAgainst { get; set; }
        public int MpLibeterianLeftVotesAgainst { get; set; }
        public int MpLibeterianRightVotesAgainst { get; set; }
        public decimal TotalMpHorizontalAvarage { get; set; }
        public decimal TotalMpVerticalAvarage { get; set; }
        public decimal OverAllRepresentationPercentage { get; set; }
        public int OverAllMpParticipationPercentage { get; set; }
        public decimal OverAllSiteRepresentative { get; set; }
        public decimal TotalVoters { get; set; }
        public decimal TotalVerifiedVoters { get; set; }
        public int TotalUnVerifiedVoters { get; set; }
        public List<BillDataModel> TrendingBills { get; set; }
    }

    public class TWFTPerson
    {
        public string member_id { get; set; }
        public string house { get; set; }
        public string first_name { get; set; }
        public string last_name { get; set; }
        public string constituency { get; set; }
        public string party { get; set; }
        public string entered_house { get; set; }
        public string left_house { get; set; }
        public string entered_reason { get; set; }
        public string left_reason { get; set; }
        public string person_id { get; set; }
        public string title { get; set; }
        public string lastupdate { get; set; }
        public string full_name { get; set; }
        public string url { get; set; }
        public string image { get; set; }
        public string image_height { get; set; }
        public string image_width { get; set; }


    }
}
