const fs = require('fs');
const file = 'duty-management-app/src/screens/admin/AllDutiesScreen.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the expense card block in modal
const oldCardBlock = `                        <TouchableOpacity
                          key={exp._id || \`exp-\${expIdx}\`}
                          style={styles.dutyExpenseCard}
                          onPress={() => setSelectedExpenseForModal(exp)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.dutyExpenseCardHeader}>
                            <View>
                              <Text style={styles.dutyExpenseClaimId}>{claimCode}</Text>
                              {expDate ? <Text style={styles.dutyExpenseClaimDate}>{expDate}</Text> : null}
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={styles.dutyExpenseClaimAmt}>
                                ₹{totalClaimAmt.toLocaleString('en-IN')}
                              </Text>
                              {exp.status ? <StatusBadge status={exp.status} /> : null}
                            </View>
                          </View>

                          {/* Items breakdown - full text detail without cluttered img */}
                          <View style={{ gap: 6, marginTop: 4 }}>
                            {items.map((it, itIdx) => {
                              const item = parseExpenseItem(it, itIdx);

                              return (
                                <View key={\`item-\${itIdx}\`} style={styles.dutyExpenseItemRow}>
                                  <View style={{ flex: 1, paddingRight: 6 }}>
                                    <Text style={styles.dutyExpenseItemTitle}>{item.displayTitle}</Text>
                                    {item.calcText ? <Text style={styles.dutyExpenseItemCalc}>{item.calcText}</Text> : null}
                                    {item.description ? <Text style={styles.dutyExpenseItemDesc}>{item.description}</Text> : null}
                                  </View>
                                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text style={styles.dutyExpenseItemAmt}>
                                      ₹{item.amount.toLocaleString('en-IN')}
                                    </Text>
                                    {item.proofUrls.length > 0 && (
                                      <View style={styles.proofCountPill}>
                                        <Ionicons name="document-attach" size={11} color="#0369A1" />
                                        <Text style={styles.proofCountPillText}>
                                          {item.proofUrls.length} {item.proofUrls.length === 1 ? 'Proof' : 'Proofs'}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>

                          {/* Action row with Admin Edit button & Tap hint */}
                          <View style={styles.claimTapHintRow}>
                            <TouchableOpacity
                              style={styles.claimInlineEditBtn}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                setInspectionModalVisible(false);
                                navigation.navigate('ExpenseForm', { expenseToEdit: exp, isAdmin: true });
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="create-outline" size={12} color="#1E40AF" />
                              <Text style={styles.claimInlineEditBtnText}>Edit Expense</Text>
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                              <Text style={styles.claimTapHintText}>Tap to view full detail</Text>
                              <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                            </View>
                          </View>
                        </TouchableOpacity>`;

const newCardBlock = `                        <View
                          key={exp._id || \`exp-\${expIdx}\`}
                          style={styles.dutyExpenseCard}
                        >
                          <TouchableOpacity
                            onPress={() => setSelectedExpenseForModal(exp)}
                            activeOpacity={0.85}
                          >
                            <View style={styles.dutyExpenseCardHeader}>
                              <View>
                                <Text style={styles.dutyExpenseClaimId}>{claimCode}</Text>
                                {expDate ? <Text style={styles.dutyExpenseClaimDate}>{expDate}</Text> : null}
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <Text style={styles.dutyExpenseClaimAmt}>
                                  ₹{totalClaimAmt.toLocaleString('en-IN')}
                                </Text>
                                {exp.status ? <StatusBadge status={exp.status} /> : null}
                              </View>
                            </View>

                            {/* Items breakdown - full text detail without cluttered img */}
                            <View style={{ gap: 6, marginTop: 4 }}>
                              {items.map((it, itIdx) => {
                                const item = parseExpenseItem(it, itIdx);

                                return (
                                  <View key={\`item-\${itIdx}\`} style={styles.dutyExpenseItemRow}>
                                    <View style={{ flex: 1, paddingRight: 6 }}>
                                      <Text style={styles.dutyExpenseItemTitle}>{item.displayTitle}</Text>
                                      {item.calcText ? <Text style={styles.dutyExpenseItemCalc}>{item.calcText}</Text> : null}
                                      {item.description ? <Text style={styles.dutyExpenseItemDesc}>{item.description}</Text> : null}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                      <Text style={styles.dutyExpenseItemAmt}>
                                        ₹{item.amount.toLocaleString('en-IN')}
                                      </Text>
                                      {item.proofUrls.length > 0 && (
                                        <View style={styles.proofCountPill}>
                                          <Ionicons name="document-attach" size={11} color="#0369A1" />
                                          <Text style={styles.proofCountPillText}>
                                            {item.proofUrls.length} {item.proofUrls.length === 1 ? 'Proof' : 'Proofs'}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </TouchableOpacity>

                          {/* Action row with Admin Edit button & Tap hint */}
                          <View style={styles.claimTapHintRow}>
                            <TouchableOpacity
                              style={styles.claimInlineEditBtn}
                              onPress={() => {
                                setSelectedDuty(null);
                                setSelectedExpenseForModal(null);
                                navigation.navigate('ExpenseForm', { expenseToEdit: exp, isAdmin: true });
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="create-outline" size={12} color="#1E40AF" />
                              <Text style={styles.claimInlineEditBtnText}>Edit Expense</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                              onPress={() => setSelectedExpenseForModal(exp)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.claimTapHintText}>Tap to view full detail</Text>
                              <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>`;

const oldOnEditModal = `        onEdit={(exp) => {
          setSelectedExpenseForModal(null);
          navigation.navigate('ExpenseForm', { expenseToEdit: exp, isAdmin: true });
        }}`;

const newOnEditModal = `        onEdit={(exp) => {
          setSelectedExpenseForModal(null);
          setSelectedDuty(null);
          navigation.navigate('ExpenseForm', { expenseToEdit: exp, isAdmin: true });
        }}`;

let norm = content.replace(/\\r\\n/g, '\\n');
const normOldCard = oldCardBlock.replace(/\\r\\n/g, '\\n');
const normNewCard = newCardBlock.replace(/\\r\\n/g, '\\n');
const normOldModal = oldOnEditModal.replace(/\\r\\n/g, '\\n');
const normNewModal = newOnEditModal.replace(/\\r\\n/g, '\\n');

if (!norm.includes(normOldCard)) {
  console.error('Target oldCardBlock not found');
  process.exit(1);
}
if (!norm.includes(normOldModal)) {
  console.error('Target oldOnEditModal not found');
  process.exit(1);
}

norm = norm.replace(normOldCard, normNewCard);
norm = norm.replace(normOldModal, normNewModal);

fs.writeFileSync(file, norm, 'utf8');
console.log('Successfully updated AllDutiesScreen.jsx');

