using System;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Democracy.Bills.Models
{
    public class TWFTDebate
    {
        public string gid { get; set; }
        public string hdate { get; set; }
        public string htype { get; set; }
        public string major { get; set; }
        public string section_id { get; set; }
        public string subsection_id { get; set; }
        public string relevance { get; set; }
        public string speaker_id { get; set; }
        public string hpos { get; set; }
        public string body { get; set; }
        public string listurl { get; set; }
        public Speaker speaker { get; set; }
        public Parent parent { get; set; }
    }

    public class Parent
    {
        public string body { get; set; }
    }

    public class Speaker
    {
        public string member_id { get; set; }
        public string title { get; set; }
        public string first_name { get; set; }
        public string last_name { get; set; }
        public string house { get; set; }
        public string constituency { get; set; }
        public string party { get; set; }
        public string person_id { get; set; }
        public string url { get; set; }
    }

    public class SearchInfo
    {
        public string s { get; set; }
        public string results_per_page { get; set; }
        public string page { get; set; }
        public string total_results { get; set; }
        public string first_result { get; set; }
    }
}
