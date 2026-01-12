import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Edit2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ExpenseManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingExpense, setEditingExpense] = useState(null);
  const [subCategory, setSubCategory] = useState('');

  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['qbExpenses'],
    queryFn: () => base44.entities.QuickBooksExpense.list()
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuickBooksExpense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qbExpenses'] });
      setEditingExpense(null);
      setSubCategory('');
    }
  });

  const categories = [...new Set(expenses.map(exp => exp.category).filter(Boolean))].sort();
  const subCategories = [...new Set(expenses.map(exp => exp.sub_category).filter(Boolean))].sort();

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = !searchTerm || 
      exp.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleSaveSubCategory = () => {
    if (editingExpense && subCategory) {
      updateExpenseMutation.mutate({
        id: editingExpense.id,
        data: { ...editingExpense, sub_category: subCategory }
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Expense Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Search</Label>
                <Input
                  placeholder="Search by vendor, description, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label>Filter by Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sub-Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExpenses.slice(0, 50).map(expense => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(expense.transaction_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {expense.vendor_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline">{expense.category || 'Uncategorized'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {expense.sub_category ? (
                            <Badge className="bg-purple-100 text-purple-700">
                              {expense.sub_category}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">Not set</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ${expense.amount?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setSubCategory(expense.sub_category || '');
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Sub-Category</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label>Vendor</Label>
                                  <p className="text-sm text-gray-600">{expense.vendor_name}</p>
                                </div>
                                <div>
                                  <Label>Category</Label>
                                  <p className="text-sm text-gray-600">{expense.category || 'Uncategorized'}</p>
                                </div>
                                <div>
                                  <Label>Amount</Label>
                                  <p className="text-sm text-gray-600">${expense.amount?.toLocaleString()}</p>
                                </div>
                                <div>
                                  <Label>Sub-Category</Label>
                                  <Select value={subCategory} onValueChange={setSubCategory}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select or type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Marketing">Marketing</SelectItem>
                                      <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                                      <SelectItem value="Software & Subscriptions">Software & Subscriptions</SelectItem>
                                      <SelectItem value="Travel">Travel</SelectItem>
                                      <SelectItem value="Utilities">Utilities</SelectItem>
                                      <SelectItem value="Professional Services">Professional Services</SelectItem>
                                      <SelectItem value="Equipment">Equipment</SelectItem>
                                      <SelectItem value="Rent">Rent</SelectItem>
                                      <SelectItem value="Insurance">Insurance</SelectItem>
                                      <SelectItem value="Payroll">Payroll</SelectItem>
                                      {subCategories.map(sc => (
                                        <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    className="mt-2"
                                    placeholder="Or type a custom sub-category..."
                                    value={subCategory}
                                    onChange={(e) => setSubCategory(e.target.value)}
                                  />
                                </div>
                                <Button 
                                  onClick={handleSaveSubCategory}
                                  disabled={updateExpenseMutation.isPending}
                                  className="w-full bg-[#264d44] hover:bg-[#1a3830]"
                                >
                                  <Save className="w-4 h-4 mr-2" />
                                  Save Sub-Category
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredExpenses.length > 50 && (
                <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                  Showing 50 of {filteredExpenses.length} expenses
                </div>
              )}
              {filteredExpenses.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400">
                  No expenses found
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}