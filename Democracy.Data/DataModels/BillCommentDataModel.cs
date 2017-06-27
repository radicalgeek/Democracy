using System;
using Democracy.Data.DataModels;
using Democracy.Models;

namespace Democracy.Bills
{
    public class BillCommentDataModel 
    {
        public int Id { get; set; }
        public DateTime CommentDate { get; set; }
        public ApplicationUser User { get; set; }
        public BillDataModel Bill { get; set; }
        public string Text { get; set; }
    }
}