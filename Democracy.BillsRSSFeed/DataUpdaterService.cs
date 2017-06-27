using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web;
using Democracy.Bills.Models;
using Democracy.Data.DataModels;
using Democracy.Data.Interfaces;
using Democracy.PublicWhip;
using Democracy.Services.Contracts.ViewModels;
using Democracy.TheyWorkForYou;
using Newtonsoft.Json;

namespace Democracy.Bills
{
    public class DataUpdaterService : IDataUpdaterService, IDisposable
    {
        private readonly IDatabaseRepository _db;
        private readonly IRssClient _rssClient;
        private HttpContext _context;

        

        public DataUpdaterService(IDatabaseRepository databaseRepository, IRssClient rssClient)
        {
            _db = databaseRepository;
            _rssClient = rssClient;
        }

        public void UpdateBillData(HttpContext context)
        {
            _context = context;
            PopulateConstituencies();
            PopulateMPs();

            var newBillList = _rssClient.GetBills("http://services.parliament.uk/bills/AllBills.rss");

            foreach (var newBillData in newBillList)
            {

                var bill = _db.Single<BillDataModel>(b => b.Url == newBillData.Url);
                if (bill != null)
                {
                    if (bill.UpdatedDate < newBillData.UpdatedDate)
                    {
                        bill.UpdatedDate = newBillData.UpdatedDate;
                        bill.BillType = newBillData.BillType;
                        bill.Description = newBillData.Description;
                        bill.House = newBillData.House;
                        bill.Stage = newBillData.Stage;
                        bill.Title = newBillData.Title;
                        bill.IsUpdated = true;
                    }
                    _db.Update<BillDataModel>(bill);
                    _db.CommitChanges();
                }
                else
                {
                    newBillData.IsNew = true;
                    _db.Add<BillDataModel>(newBillData);
                    _db.CommitChanges();
                    bill = _db.Single<BillDataModel>(b => b.Url == newBillData.Url);
                }

                var parliamentaryDebates = PopulateParliamentaryDebatesForBill(bill.Id);
                if (parliamentaryDebates.Count > 0)
                {
                    var debates = new List<DebateDataModel>();
                    foreach (var debateResult in parliamentaryDebates)
                    {
                        if (debateResult.speaker != null)
                        {
                            var mpId = Convert.ToInt32(debateResult.speaker.person_id);
                            var speakingMP = _db.Single<MPDataModel>(m => m.TWFYPersonId == mpId);
                            debates.Add(new DebateDataModel
                            {
                                Body = debateResult.body,
                                Date = DateTime.Parse(debateResult.hdate),
                                Speaker = speakingMP,
                                BillId = bill.Id

                            });
                        }

                    }
                    _db.Add<DebateDataModel>(debates);
                }
            }
            var voteDataProvider = new VoteData(_db);
            voteDataProvider.PopulateVoteData();
        }


        


        private List<TWFTDebate> PopulateParliamentaryDebatesForBill(int id)
        {
            var bill = _db.Single<BillDataModel>(b => b.Id == id);

            string searchTerm = bill.Title;
            if (bill.Title.Contains("Act"))
            {
                searchTerm = searchTerm.ToLower().Replace("act", "bill");
                searchTerm = Regex.Replace(searchTerm, @"\d+$", String.Empty);
            }

            Democracy.TheyWorkForYou.API theyWorkForYouApi = new Democracy.TheyWorkForYou.API();
            string result1 = theyWorkForYouApi.Query("getDebates",
                new string[] { "type:commons", "num:10000", "order:d", "search:\"" + searchTerm + "\"" });
            //string result2 = theyWorkForYouApi.Query("getDebates", new string[] { "type:westminsterhall", "search:" + bill.Title });
            //string result3 = theyWorkForYouApi.Query("getDebates", new string[] { "type:lords", "search:" + bill.Title });
            //string result4 = theyWorkForYouApi.Query("getDebates", new string[] { "type:scotland", "search:" + bill.Title });
            //string result5 = theyWorkForYouApi.Query("getDebates", new string[] { "type:northernireland", "search:" + bill.Title });

            var filterResults = new List<TWFTDebate>();
            try
            {
                var commonsResults = JsonConvert.DeserializeObject<TWFYDebateSearchResults>(result1);
                filterResults = commonsResults.rows; //.Where(result => result.parent.body.ToLower().Contains(searchTerm.Trim())).ToList();
            }
            catch (Exception)
            {

            }



            return filterResults;
        }

        private List<OfficeDataModel> SetMPOffices(TWFYMPResults mpResult)
        {
            var offices = new List<OfficeDataModel>();
            if (mpResult.offices != null && mpResult.offices.Count > 0)
            {
                offices = mpResult.offices.Select(officeResult => new OfficeDataModel()
                {
                    Department = officeResult.dept,
                    Position = officeResult.position,
                    FromDate = officeResult.from_date,
                    ToDate = officeResult.to_date
                }).ToList();
            }
            return offices;

        }

        private ConstituencyDataModel GetMPConstituancy(string constituency)
        {
            return _db.Single<ConstituencyDataModel>(c => c.Name == constituency);
        }

        private void PopulateConstituencies()
        {
            Democracy.TheyWorkForYou.API theyWorkForYouApi = new Democracy.TheyWorkForYou.API();
            string result = theyWorkForYouApi.Query("getConstituencies", new string[] { });
            var constituenciesResults = JsonConvert.DeserializeObject<List<TWFYConstituenciesSearchResults>>(result);

            foreach (var constituencyData in constituenciesResults)
            {
                var constituency = _db.Single<ConstituencyDataModel>(c => c.Name == constituencyData.Name);

                if (constituency == null)
                {
                    var newConstituency = new ConstituencyDataModel()
                    {
                        Name = constituencyData.Name,
                        RegisterdVoters = GetVotersForConstituency(constituencyData.Name)
                    };
                    _db.Add<ConstituencyDataModel>(newConstituency);
                }
            }
            _db.CommitChanges();
        }

        private int GetVotersForConstituency(string name)
        {
            var currentDirectory = _context.Server.MapPath("~");
            string filePath = currentDirectory + @"\ConstituencyPopulations.txt";
            StreamReader sr = new StreamReader(filePath);
            var lines = new List<string[]>();
            int Row = 0;
            while (!sr.EndOfStream)
            {
                string[] Line = sr.ReadLine().Split(new char[] { '\t' });
                lines.Add(Line);
                Row++;
                Console.WriteLine(Row);
            }

            var data = lines.ToArray();
            var thisConstituency = lines.First(l => l[0] == name);
            return Convert.ToInt32(thisConstituency[1].Replace('"', ' ').Replace(",", "").Trim());
        }

        private void PopulateMPs()
        {
            var dict = new Dictionary<string, PartyDataModel> {
            { "Conservative", PartyDataModel.Conservative },
            { "Labour", PartyDataModel.Labour },
            { "Liberal Democrat", PartyDataModel.LibDem },
            { "Green", PartyDataModel.Green },
            { "UKIP", PartyDataModel.UKIP },
            { "DUP", PartyDataModel.DUP },
            {"Social Democratic and Labour Party", PartyDataModel.SDL},
            {"Sinn Fein", PartyDataModel.SinnFain},
            {"Respect", PartyDataModel.Respect},
            {"Plaid Cymru", PartyDataModel.PalidCyeru},
            {"UUP", PartyDataModel.UUP},
            {"Independent", PartyDataModel.Independent},
            {"Scottish National Party", PartyDataModel.SNP},
            {"Deputy Speaker", PartyDataModel.DS},
            {"Independent Labour", PartyDataModel.IndependentLabour},
            {"Speaker", PartyDataModel.Speaker},
            {"Alliance", PartyDataModel.Alliance}
        };


            Democracy.TheyWorkForYou.API theyWorkForYouApi = new Democracy.TheyWorkForYou.API();
            string result = theyWorkForYouApi.Query("getMPs", new string[]
            {
                "date:01/01/2015",
                "output:js"

            });
            var MPsResults = JsonConvert.DeserializeObject<List<TWFYMPResults>>(result);

            foreach (var MPResult in MPsResults)
            {
                var mp = _db.Single<MPDataModel>(c => c.TWFYMemberId.ToString() == MPResult.member_id);

                if (mp == null)
                {
                    var newMP = new MPDataModel();
                    newMP.ImageUrl = GetMpPicture(MPResult);
                    newMP.Name = MPResult.name;
                    newMP.TWFYMemberId = Convert.ToInt32(MPResult.member_id);
                    newMP.TWFYPersonId = Convert.ToInt32(MPResult.person_id);
                    newMP.Party = dict[MPResult.party];
                    newMP.Constituency = GetMPConstituancy(MPResult.constituency);
                    newMP.Offices = SetMPOffices(MPResult);
                    _db.Add<MPDataModel>(newMP);
                }
            }
            _db.CommitChanges();
        }

        private string GetMpPicture(TWFYMPResults mpResult)
        {
            var theyWordkForYour = new API();
            List<TWFTPerson> result = JsonConvert.DeserializeObject<List<TWFTPerson>>(theyWordkForYour.Query("getPerson", new string[]
            {
                "id:" + mpResult.person_id, 
                "output:js"
            }));
            return "http://www.theyworkforyou.com/" + result[0].image;
        }

        public void Dispose()
        {
            
        }
    }
}
