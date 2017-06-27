using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Democracy.Data.DataModels;
using Democracy.Data.Interfaces;
using Democracy.PublicWhip.Extensions;

namespace Democracy.PublicWhip
{
    public class VoteData
    {
        private IDatabaseRepository _db;
        public VoteData(IDatabaseRepository db)
        {
            _db = db;
        }
        public void PopulateVoteData()
        {

            string remoteUri = "http://www.publicwhip.org.uk/data/";
            string fileName = "votematrix-2010.dat", myStringWebResource = null;
            Stream file;

            using (WebClient myWebClient = new WebClient())
            {
                myStringWebResource = remoteUri + fileName;
                file = myWebClient.OpenRead(myStringWebResource); 
            }


            using (StreamReader sr = new StreamReader(file))
            {
                int columncount = 0;
                string headerRow = sr.ReadLine();
                string[] headers = headerRow.Split('\t');
                headers = RemoveUnusedHeaderInfo(headers);
                while (sr.Peek() != -1)
                {
                    columncount = 0;
                    string voteData = sr.ReadLine();

                    string[] cells = voteData.Split('\t');
                    if (cells.Count() > 1)
                    {
                        var bill = FindBill(cells[3]);
                        if (bill != null)
                        {
                            var voteDate = cells[1];
                            cells = cells.RemoveAt(0);
                            cells = cells.RemoveAt(0);
                            cells = cells.RemoveAt(0);
                            cells = cells.RemoveAt(0);


                            foreach (var cell in cells)
                            {
                                if (!string.IsNullOrWhiteSpace(cell))
                                {
                                    var mpVote = new MpVoteRecord()
                                    {
                                        Date = DateTime.Parse(voteDate),
                                        Mp = GetMp(headers[columncount]),
                                        Bill = bill,
                                        Vote = GetVoteType(cell.Trim())
                                    };
                                    columncount++;
                                    _db.Add<MpVoteRecord>(mpVote);
                                    _db.CommitChanges();
                                }
                            }
                        }   
                    }
                    
                }
            }
        }

        private MPDataModel GetMp(string mpId)
        {
            mpId = mpId.Replace("mpid", "");
            
            int id = Convert.ToInt32(mpId);
            return _db.Single<MPDataModel>(mp => mp.TWFYMemberId == id);
        }

        private VoteType GetVoteType(string cell)
        {
            switch (cell)
            {
                case "-9":
                    return VoteType.Missing;
                    break;
                case "1":
                    return VoteType.TellAye;
                    break;
                case "2":
                    return VoteType.Aye;
                    break;
                case "3":
                    return VoteType.Both;
                    break;
                case "4":
                    return VoteType.No;
                    break;
                case "5":
                    return VoteType.TellNo;
                    break;
                default:
                    return VoteType.Missing;
                    break;
            }
        }

        private static string[] RemoveUnusedHeaderInfo(string[] headers)
        {
            headers = headers.RemoveAt(0);
            headers = headers.RemoveAt(0);
            headers = headers.RemoveAt(0);
            headers = headers.RemoveAt(0);
            return headers;
        }

        private BillDataModel FindBill(string billName)
        {
            return _db.Single<BillDataModel>(b => b.Title == billName);
        }
    }
}
